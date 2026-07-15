import { httpError } from "@shared/common-lib";
import {
    and,
    count,
    desc,
    eq,
    ilike,
    inArray,
    isNull,
    or,
    sql,
    type SQL,
} from "drizzle-orm";
import { CopyConditions } from "minio";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { db } from "../../db/db-conn.ts";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import { archiveSubmissions } from "../../db/schemas/archive-submission.ts";
import type { ArchiveFieldConfigSnapshot, ArchiveFieldValueSnapshot } from "../../db/schemas/archive-submission.ts";
import { ArchiveSubmissionStatus } from "../../db/schemas/archive-constants.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { dossierPhysicalPlacements } from "../../db/schemas/dossier-physical-placement.ts";
import { DossierPhysicalPlacementStatus } from "../../db/schemas/dossier-physical-placement-constants.ts";
import { fonds } from "../../db/schemas/fond.ts";
import { inventories } from "../../db/schemas/inventory.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import {
    ArchiveScopeResolver,
    type ArchiveDataScope,
} from "../archive-permission/archive-scope-resolver.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { hasArchiveWarehousePermission } from "./archive-warehouse-permissions.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import {
    getRawStoragePrefix,
    normalizeStorageKey,
    storageBasename,
    toSearchablePdfKey,
} from "../dossier/dossier-path-utils.ts";
import { isProtectedArchivalKey } from "../dossier/dossier-delete-utils.ts";
import { DossierService } from "../dossier/dossier-service.ts";
import { buildLinkGet } from "../data-entry/data-entry-s3-utils.ts";
import { statStorageObject } from "../scan-intake/scan-intake-s3-utils.ts";
import { searchDocuments, searchMetadataDocuments } from "@shared/search-engine";
import { DOSSIER_ENTITY_TYPE } from "../search/adapters/dossier.adapter.ts";
import { dossierTypes } from "../../db/schemas/dossier-type.ts";
import {
    reopenDossierForOcr,
    resolveWorkingFilePath,
} from "./archive-warehouse-reopen.ts";

export const WAREHOUSE_DOSSIER_STATUSES = [DossierStatus.ARCHIVED] as const;
export type WarehouseDossierStatus = (typeof WAREHOUSE_DOSSIER_STATUSES)[number];

export type BrowseArchiveWarehouseQuery = {
    page?: number;
    limit?: number;
    fondId?: string;
    search?: string;
    year?: number;
    status?: WarehouseDossierStatus;
};

type LatestSubmissionRow = {
    dossierId: string;
    reviewedAt: Date | null;
    fieldValues: ArchiveFieldValueSnapshot;
    fieldConfigSnapshot: ArchiveFieldConfigSnapshot;
    archiveYear: number | null;
};

export async function resolveWarehouseScope(profile: UserWithRoles) {
    const candidates = [
        Permission.ARCHIVE_WAREHOUSE_READ,
        Permission.ARCHIVE_WAREHOUSE_SEARCH,
        Permission.ARCHIVE_WAREHOUSE_EDIT,
        Permission.ARCHIVE_WAREHOUSE_DELETE,
        Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
    ] as const;
    const warehousePermission = candidates.find((key) =>
        hasArchiveWarehousePermission(profile, key)
    ) ?? Permission.ARCHIVE_WAREHOUSE_READ;

    const scope = await ArchiveScopeResolver.resolve(profile, {
        warehousePermission,
    });
    return {
        scope,
        fondScope: scope.mode === "global"
            ? null
            : scope.mode === "scoped" || scope.mode === "fond"
            ? scope.fondIds
            : [],
    };
}

export function assertFondAccess(
    scope: ArchiveDataScope,
    fondId?: string,
): string {
    const trimmed = fondId?.trim();
    if (!trimmed) {
        throw httpError.badRequest("fondId là bắt buộc");
    }
    if (scope.mode === "none") {
        throw httpError.forbidden("Bạn không có quyền truy cập phông này");
    }
    if (scope.mode === "global") {
        return trimmed;
    }
    if (
        (scope.mode === "scoped" || scope.mode === "fond")
        && !scope.fondIds.includes(trimmed)
    ) {
        throw httpError.forbidden("Bạn không có quyền truy cập phông này");
    }
    return trimmed;
}

function assertDossierTypeAccess(
    scope: ArchiveDataScope,
    dossierTypeId: string | null | undefined,
): void {
    if (scope.mode !== "scoped") return;
    // Chưa gán loại hồ sơ trên ACL → không lọc theo trục này.
    if (scope.dossierTypeIds.length === 0) return;
    if (!dossierTypeId || !scope.dossierTypeIds.includes(dossierTypeId)) {
        throw httpError.forbidden("Bạn không có quyền truy cập loại hồ sơ này");
    }
}

function resolveWarehouseStatus(status?: string): WarehouseDossierStatus {
    const value = status?.trim() || DossierStatus.ARCHIVED;
    if (!(WAREHOUSE_DOSSIER_STATUSES as ReadonlyArray<string>).includes(value)) {
        throw httpError.badRequest(`Trạng thái hồ sơ không hợp lệ: ${value}`);
    }
    return value as WarehouseDossierStatus;
}

function yearFilterCondition(year: number): SQL {
    return sql`exists (
        select 1
        from ${archiveSubmissions} s
        inner join ${inventories} i on i.id = (s.field_values->>'inventory')
        where s.dossier_id = ${dossiers.id}
          and s.status = ${ArchiveSubmissionStatus.APPROVED}
          and i.submission_year = ${year}
    )`;
}

async function loadLatestApprovedSubmissions(
    dossierIds: string[],
): Promise<Map<string, LatestSubmissionRow>> {
    if (dossierIds.length === 0) {
        return new Map();
    }

    const rows = await db
        .selectDistinctOn([archiveSubmissions.dossierId], {
            dossierId: archiveSubmissions.dossierId,
            reviewedAt: archiveSubmissions.reviewedAt,
            fieldValues: archiveSubmissions.fieldValues,
            fieldConfigSnapshot: archiveSubmissions.fieldConfigSnapshot,
            inventoryId: sql<string | null>`${archiveSubmissions.fieldValues}->>'inventory'`,
        })
        .from(archiveSubmissions)
        .where(and(
            inArray(archiveSubmissions.dossierId, dossierIds),
            eq(archiveSubmissions.status, ArchiveSubmissionStatus.APPROVED),
        ))
        .orderBy(archiveSubmissions.dossierId, desc(archiveSubmissions.reviewedAt));

    const inventoryIds = [
        ...new Set(
            rows
                .map((row) => row.inventoryId?.trim())
                .filter((id): id is string => Boolean(id)),
        ),
    ];

    const yearByInventoryId = new Map<string, number>();
    if (inventoryIds.length > 0) {
        const inventoryRows = await db
            .select({
                id: inventories.id,
                submissionYear: inventories.submissionYear,
            })
            .from(inventories)
            .where(inArray(inventories.id, inventoryIds));

        for (const row of inventoryRows) {
            yearByInventoryId.set(row.id, row.submissionYear);
        }
    }

    const result = new Map<string, LatestSubmissionRow>();
    for (const row of rows) {
        const inventoryId = row.inventoryId?.trim();
        result.set(row.dossierId, {
            dossierId: row.dossierId,
            reviewedAt: row.reviewedAt,
            fieldValues: row.fieldValues,
            fieldConfigSnapshot: row.fieldConfigSnapshot,
            archiveYear: inventoryId
                ? yearByInventoryId.get(inventoryId) ?? null
                : null,
        });
    }
    return result;
}

async function loadDocumentStatsByDossierIds(dossierIds: string[]) {
    if (dossierIds.length === 0) {
        return new Map<string, { documentCount: number; totalSizeKb: number }>();
    }

    const rows = await db
        .select({
            dossierId: dossierFiles.dossierId,
            documentCount: sql<number>`count(*)::int`.mapWith(Number),
            totalSizeKb: sql<number>`coalesce(sum(${dossierFiles.fileSizeKb}), 0)`.mapWith(Number),
        })
        .from(dossierFiles)
        .where(inArray(dossierFiles.dossierId, dossierIds))
        .groupBy(dossierFiles.dossierId);

    return new Map(
        rows.map((row) => [
            row.dossierId,
            { documentCount: row.documentCount, totalSizeKb: row.totalSizeKb },
        ]),
    );
}

async function loadActivePhysicalPlacementFlags(
    dossierIds: string[],
): Promise<Set<string>> {
    if (dossierIds.length === 0) {
        return new Set();
    }

    const rows = await db
        .select({
            dossierId: dossierPhysicalPlacements.dossierId,
        })
        .from(dossierPhysicalPlacements)
        .where(
            and(
                inArray(dossierPhysicalPlacements.dossierId, dossierIds),
                eq(
                    dossierPhysicalPlacements.status,
                    DossierPhysicalPlacementStatus.ACTIVE,
                ),
            ),
        );

    return new Set(rows.map((row) => row.dossierId));
}

function buildArchivedDossierWhere(
    fondId: string,
    status: WarehouseDossierStatus,
    search?: string,
    year?: number,
    dossierTypeIds?: string[],
) {
    const searchTerm = search?.trim();
    const searchCondition = searchTerm
        ? or(
            ilike(dossiers.name, `%${searchTerm}%`),
            ilike(dossiers.folderPath, `%${searchTerm}%`),
        )
        : undefined;

    return activeDossierWhere(
        eq(dossiers.fondId, fondId),
        eq(dossiers.status, status),
        ...(dossierTypeIds && dossierTypeIds.length > 0
            ? [inArray(dossiers.dossierTypeId, dossierTypeIds)]
            : []),
        ...(year != null ? [yearFilterCondition(year)] : []),
        ...(searchCondition ? [searchCondition] : []),
    );
}

async function loadAvailableYears(fondId: string, status: WarehouseDossierStatus) {
    const rows = await db
        .selectDistinct({
            submissionYear: inventories.submissionYear,
        })
        .from(dossiers)
        .innerJoin(
            archiveSubmissions,
            and(
                eq(archiveSubmissions.dossierId, dossiers.id),
                eq(archiveSubmissions.status, ArchiveSubmissionStatus.APPROVED),
            ),
        )
        .innerJoin(
            inventories,
            sql`${inventories.id} = (${archiveSubmissions.fieldValues}->>'inventory')`,
        )
        .where(activeDossierWhere(
            eq(dossiers.fondId, fondId),
            eq(dossiers.status, status),
        ))
        .orderBy(desc(inventories.submissionYear));

    return rows
        .map((row) => row.submissionYear)
        .filter((year): year is number => year != null);
}

export const ArchiveWarehouseService = {
    async listFonds(profile: UserWithRoles) {
        const { scope } = await resolveWarehouseScope(profile);
        if (scope.mode === "none") {
            return { items: [] as Array<typeof fonds.$inferSelect> };
        }

        const conditions = [
            eq(fonds.isActive, true),
            isNull(fonds.deletedAt),
        ];
        if (scope.mode === "scoped" || scope.mode === "fond") {
            if (scope.fondIds.length === 0) {
                return { items: [] as Array<typeof fonds.$inferSelect> };
            }
            conditions.push(inArray(fonds.id, scope.fondIds));
        }

        const items = await db
            .select()
            .from(fonds)
            .where(and(...conditions))
            .orderBy(fonds.fondName);

        return { items };
    },

    async getFondSummary(
        profile: UserWithRoles,
        fondId: string,
        statusInput?: string,
    ) {
        const { scope, fondScope } = await resolveWarehouseScope(profile);
        const effectiveFondId = assertFondAccess(scope, fondId);
        const status = resolveWarehouseStatus(statusInput);
        const dossierTypeIds = scope.mode === "scoped" && scope.dossierTypeIds.length > 0
            ? scope.dossierTypeIds
            : undefined;

        const whereClause = buildArchivedDossierWhere(
            effectiveFondId,
            status,
            undefined,
            undefined,
            dossierTypeIds,
        );

        const dossierRows = await db
            .select({ id: dossiers.id })
            .from(dossiers)
            .where(whereClause);

        const dossierIds = dossierRows.map((row) => row.id);
        const docStats = await loadDocumentStatsByDossierIds(dossierIds);

        let documentCount = 0;
        let totalSizeKb = 0;
        for (const stats of docStats.values()) {
            documentCount += stats.documentCount;
            totalSizeKb += stats.totalSizeKb;
        }

        const availableYears = await loadAvailableYears(effectiveFondId, status);

        return {
            fondId: effectiveFondId,
            dossierCount: dossierIds.length,
            documentCount,
            totalSizeKb,
            availableYears,
            fondScope,
        };
    },

    async browseDossiers(profile: UserWithRoles, query: BrowseArchiveWarehouseQuery) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const offset = (page - 1) * limit;

        const { scope, fondScope } = await resolveWarehouseScope(profile);
        const effectiveFondId = assertFondAccess(scope, query.fondId);
        const status = resolveWarehouseStatus(query.status);
        const year = query.year != null && !Number.isNaN(query.year)
            ? query.year
            : undefined;

        const whereClause = buildArchivedDossierWhere(
            effectiveFondId,
            status,
            query.search,
            year,
            scope.mode === "scoped" && scope.dossierTypeIds.length > 0
                ? scope.dossierTypeIds
                : undefined,
        );

        const [rows, countRows] = await Promise.all([
            db
                .select({
                    id: dossiers.id,
                    name: dossiers.name,
                    folderPath: dossiers.folderPath,
                    status: dossiers.status,
                    projectCode: dossiers.projectCode,
                    fondId: dossiers.fondId,
                    fondName: fonds.fondName,
                    updatedAt: dossiers.updatedAt,
                })
                .from(dossiers)
                .leftJoin(
                    fonds,
                    and(eq(fonds.id, dossiers.fondId), isNull(fonds.deletedAt)),
                )
                .where(whereClause)
                .orderBy(desc(dossiers.updatedAt))
                .limit(limit)
                .offset(offset),
            db
                .select({ count: sql<number>`count(*)::int` })
                .from(dossiers)
                .where(whereClause),
        ]);

        const dossierIds = rows.map((row) => row.id);
        const [submissionMap, docStatsMap, placedIds] = await Promise.all([
            loadLatestApprovedSubmissions(dossierIds),
            loadDocumentStatsByDossierIds(dossierIds),
            loadActivePhysicalPlacementFlags(dossierIds),
        ]);

        const items = rows.map((row) => {
            const submission = submissionMap.get(row.id);
            const docStats = docStatsMap.get(row.id);
            return {
                ...row,
                documentCount: docStats?.documentCount ?? 0,
                totalSizeKb: docStats?.totalSizeKb ?? 0,
                archivedAt: submission?.reviewedAt ?? null,
                archiveYear: submission?.archiveYear ?? null,
                hasPhysicalPlacement: placedIds.has(row.id),
            };
        });

        const total = countRows[0]?.count ?? 0;

        return {
            items,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            fondScope,
            fondId: effectiveFondId,
        };
    },

    async getDossierDetail(profile: UserWithRoles, dossierId: string) {
        const { scope } = await resolveWarehouseScope(profile);

        const [dossier] = await db
            .select({
                id: dossiers.id,
                name: dossiers.name,
                folderPath: dossiers.folderPath,
                status: dossiers.status,
                projectCode: dossiers.projectCode,
                fondId: dossiers.fondId,
                fondName: fonds.fondName,
                dossierTypeId: dossiers.dossierTypeId,
                updatedAt: dossiers.updatedAt,
                currentMetadataKey: dossiers.currentMetadataKey,
                ocrMetadataKey: dossiers.ocrMetadataKey,
            })
            .from(dossiers)
            .leftJoin(
                fonds,
                and(eq(fonds.id, dossiers.fondId), isNull(fonds.deletedAt)),
            )
            .where(activeDossierWhere(eq(dossiers.id, dossierId)))
            .limit(1);

        if (!dossier) {
            throw httpError.notFound("Không tìm thấy hồ sơ");
        }

        if (!(WAREHOUSE_DOSSIER_STATUSES as ReadonlyArray<string>).includes(dossier.status)) {
            throw httpError.notFound("Hồ sơ chưa được lưu kho");
        }

        assertFondAccess(scope, dossier.fondId ?? undefined);
        assertDossierTypeAccess(scope, dossier.dossierTypeId);

        const [submissionMap, docStatsMap, placedIds] = await Promise.all([
            loadLatestApprovedSubmissions([dossier.id]),
            loadDocumentStatsByDossierIds([dossier.id]),
            loadActivePhysicalPlacementFlags([dossier.id]),
        ]);
        const submission = submissionMap.get(dossier.id);
        const docStats = docStatsMap.get(dossier.id);

        const fileRows = await db
            .select({
                id: dossierFiles.id,
                fileName: dossierFiles.fileName,
                filePath: dossierFiles.filePath,
                fileSizeKb: dossierFiles.fileSizeKb,
                createdAt: dossierFiles.createdAt,
            })
            .from(dossierFiles)
            .where(eq(dossierFiles.dossierId, dossier.id))
            .orderBy(dossierFiles.fileName);

        const files = await Promise.all(
            fileRows.map(async (file) => {
                const searchablePdfPath = toSearchablePdfKey(file.filePath);
                return {
                    id: file.id,
                    fileName: file.fileName,
                    filePath: file.filePath,
                    fileSizeKb: file.fileSizeKb,
                    createdAt: file.createdAt,
                    fileUrl: (await buildLinkGet(file.filePath)) ?? "",
                    searchablePdfPath,
                    searchablePdfUrl: searchablePdfPath
                        ? (await buildLinkGet(searchablePdfPath)) ?? ""
                        : null,
                };
            }),
        );

        const metadataKey = dossier.currentMetadataKey ?? dossier.ocrMetadataKey;
        const metadataKeyJson =
            metadataKey && !metadataKey.endsWith(".json")
                ? `${metadataKey}.json`
                : metadataKey;
        const currentMetadataUrl = await buildLinkGet(metadataKeyJson);

        const {
            currentMetadataKey: _currentMetadataKey,
            ocrMetadataKey: _ocrMetadataKey,
            ...dossierPublic
        } = dossier;

        return {
            dossier: {
                ...dossierPublic,
                documentCount: docStats?.documentCount ?? 0,
                totalSizeKb: docStats?.totalSizeKb ?? 0,
                archivedAt: submission?.reviewedAt ?? null,
                archiveYear: submission?.archiveYear ?? null,
                hasPhysicalPlacement: placedIds.has(dossier.id),
            },
            archiveSubmission: submission
                ? {
                    reviewedAt: submission.reviewedAt,
                    fieldValues: submission.fieldValues,
                    fieldConfigSnapshot: submission.fieldConfigSnapshot,
                    archiveYear: submission.archiveYear,
                }
                : null,
            files,
            currentMetadataUrl,
        };
    },

    async searchContent(
        profile: UserWithRoles,
        input: {
            q?: string;
            fondId?: string;
            limit?: number;
            offset?: number;
            groupCode?: string;
            trangThaiHoSo?: string;
        },
    ) {
        const q = input.q?.trim() ?? "";
        const limit = Math.min(input.limit ?? 20, 50);
        const offset = input.offset ?? 0;

        const { scope, fondScope } = await resolveWarehouseScope(profile);
        if (!q || scope.mode === "none") {
            return {
                items: [],
                total: 0,
                took_ms: 0,
                fondScope: scope.mode === "scoped" || scope.mode === "fond"
                    ? scope.fondIds
                    : scope.mode === "global"
                    ? null
                    : [],
                message: "Không tìm thấy kết quả phù hợp",
            };
        }

        let fondIds: string[] | undefined;
        if (input.fondId) {
            const effectiveFondId = assertFondAccess(scope, input.fondId);
            fondIds = [effectiveFondId];
        } else if (scope.mode === "scoped" || scope.mode === "fond") {
            fondIds = scope.fondIds;
        }

        if (fondIds && fondIds.length === 0) {
            return {
                items: [],
                total: 0,
                took_ms: 0,
                fondScope,
                message: "Không tìm thấy kết quả phù hợp",
            };
        }

        const result = await searchDocuments({
            q,
            groupCode: input.groupCode,
            trangThaiHoSo: input.trangThaiHoSo,
            filters: {
                entityTypes: [DOSSIER_ENTITY_TYPE],
                dossierStatus: DossierStatus.ARCHIVED,
                ...(fondIds ? { fondIds } : {}),
                ...(scope.mode === "scoped" && scope.dossierTypeIds.length > 0
                    ? { dossierTypeIds: scope.dossierTypeIds }
                    : {}),
            },
            from: offset,
            size: limit,
        });

        return {
            items: result.hits.map((hit) => ({
                entityType: hit.entityType,
                entityId: hit.entityId,
                title: hit.title,
                fondId: hit.fondId ?? null,
                fondName: hit.fondName ?? null,
                dossierTypeId: hit.dossierTypeId ?? null,
                dossierTypeName: hit.dossierTypeName ?? null,
                editorId: hit.editorId ?? null,
                editorName: hit.editorName ?? null,
                editCompletedAt: hit.editCompletedAt ?? null,
                archivedAt: hit.archivedAt ?? null,
                fileNames: hit.fileNames ?? [],
                hoSoId: hit.hoSoId ?? null,
                trangThaiHoSo: hit.trangThaiHoSo ?? null,
                snippet: hit.snippet,
                score: hit.score,
                matches: hit.matches ?? [],
                metadata: hit.metadata ?? {},
            })),
            total: result.total,
            took_ms: result.took,
            fondScope,
            message: result.total === 0 ? "Không tìm thấy kết quả phù hợp" : null,
        };
    },

    async searchMetadata(
        profile: UserWithRoles,
        input: {
            dossierName?: string;
            documentName?: string;
            fondId?: string;
            dossierTypeId?: string;
            editorName?: string;
            editCompletedAtFrom?: string;
            editCompletedAtTo?: string;
            archivedAtFrom?: string;
            archivedAtTo?: string;
            limit?: number;
            offset?: number;
        },
    ) {
        const limit = Math.min(input.limit ?? 20, 50);
        const offset = input.offset ?? 0;
        const { scope, fondScope } = await resolveWarehouseScope(profile);

        if (scope.mode === "none") {
            return {
                items: [],
                total: 0,
                took_ms: 0,
                fondScope: [],
                message: "Không tìm thấy kết quả phù hợp",
            };
        }

        const hasCriteria = Boolean(
            input.dossierName?.trim() ||
                input.documentName?.trim() ||
                input.dossierTypeId?.trim() ||
                input.editorName?.trim() ||
                input.editCompletedAtFrom?.trim() ||
                input.editCompletedAtTo?.trim() ||
                input.archivedAtFrom?.trim() ||
                input.archivedAtTo?.trim() ||
                input.fondId?.trim(),
        );

        if (!hasCriteria) {
            return {
                items: [],
                total: 0,
                took_ms: 0,
                fondScope,
                message: "Vui lòng nhập ít nhất một tiêu chí tra cứu",
            };
        }

        let fondIds: string[] | undefined;
        if (input.fondId?.trim()) {
            const effectiveFondId = assertFondAccess(scope, input.fondId.trim());
            fondIds = [effectiveFondId];
        } else if (scope.mode === "scoped" || scope.mode === "fond") {
            fondIds = scope.fondIds;
        }

        if (fondIds && fondIds.length === 0) {
            return {
                items: [],
                total: 0,
                took_ms: 0,
                fondScope,
                message: "Không tìm thấy kết quả phù hợp",
            };
        }

        if (
            input.dossierTypeId?.trim() &&
            scope.mode === "scoped" &&
            scope.dossierTypeIds.length > 0 &&
            !scope.dossierTypeIds.includes(input.dossierTypeId.trim())
        ) {
            throw httpError.forbidden("Bạn không có quyền truy cập loại hồ sơ này trong kho");
        }

        const result = await searchMetadataDocuments({
            dossierName: input.dossierName,
            documentName: input.documentName,
            fondIds,
            dossierTypeId: input.dossierTypeId,
            editorName: input.editorName,
            editCompletedAtFrom: input.editCompletedAtFrom,
            editCompletedAtTo: input.editCompletedAtTo,
            archivedAtFrom: input.archivedAtFrom,
            archivedAtTo: input.archivedAtTo,
            filters: {
                entityTypes: [DOSSIER_ENTITY_TYPE],
                dossierStatus: DossierStatus.ARCHIVED,
                ...(scope.mode === "scoped" && scope.dossierTypeIds.length > 0
                    ? { dossierTypeIds: scope.dossierTypeIds }
                    : {}),
            },
            from: offset,
            size: limit,
        });

        return {
            items: result.hits.map((hit) => ({
                entityType: hit.entityType,
                entityId: hit.entityId,
                title: hit.title,
                fondId: hit.fondId ?? null,
                fondName: hit.fondName ?? null,
                dossierTypeId: hit.dossierTypeId ?? null,
                dossierTypeName: hit.dossierTypeName ?? null,
                editorId: hit.editorId ?? null,
                editorName: hit.editorName ?? null,
                editCompletedAt: hit.editCompletedAt ?? null,
                archivedAt: hit.archivedAt ?? null,
                fileNames: hit.fileNames ?? [],
                hoSoId: hit.hoSoId ?? null,
                trangThaiHoSo: hit.trangThaiHoSo ?? null,
                score: hit.score,
                metadata: hit.metadata ?? {},
            })),
            total: result.total,
            took_ms: result.took,
            fondScope,
            message: result.total === 0 ? "Không tìm thấy kết quả phù hợp" : null,
        };
    },

    async listDossierTypes(profile: UserWithRoles) {
        const { scope } = await resolveWarehouseScope(profile);
        if (scope.mode === "none") {
            return { items: [] as Array<{ id: string; name: string }> };
        }

        const conditions: SQL[] = [
            eq(dossiers.status, DossierStatus.ARCHIVED),
            isNull(dossiers.deletedAt),
        ];
        if (scope.mode === "scoped" || scope.mode === "fond") {
            if (scope.fondIds.length === 0) return { items: [] };
            conditions.push(inArray(dossiers.fondId, scope.fondIds));
        }
        if (scope.mode === "scoped" && scope.dossierTypeIds.length > 0) {
            conditions.push(inArray(dossiers.dossierTypeId, scope.dossierTypeIds));
        }

        const rows = await db
            .selectDistinct({
                id: dossierTypes.id,
                name: dossierTypes.name,
            })
            .from(dossierTypes)
            .innerJoin(dossiers, eq(dossiers.dossierTypeId, dossierTypes.id))
            .where(and(...conditions))
            .orderBy(dossierTypes.name);

        return { items: rows };
    },

    async createReuploadUploadPoint(
        profile: UserWithRoles,
        input: { dossierId: string; fileId: string },
    ) {
        if (!hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_REUPLOAD)) {
            throw httpError.forbidden("Bạn không có quyền upload lại file trong kho");
        }
        const { dossier, file } = await loadArchivedFileForWarehouse(
            profile,
            input.dossierId,
            input.fileId,
            Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
        );

        const rawPrefix = getRawStoragePrefix();
        const prefix = `${rawPrefix}/warehouse-reupload/${dossier.id}/`;

        const uploadPoint = await DossierService.createUploadPoint({
            prefix,
            projectCode: dossier.projectCode ?? undefined,
            contentTypePrefix: "application/pdf",
        });

        return {
            ...uploadPoint,
            sourceFileId: file.id,
            sourceFileName: file.fileName,
            suggestedFileName: file.fileName,
        };
    },

    async reuploadFile(
        profile: UserWithRoles,
        input: {
            dossierId: string;
            fileId: string;
            /** When set, PDF already uploaded to staging; replaces the selected file then reopens OCR. */
            key?: string;
        },
    ) {
        if (!hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_REUPLOAD)) {
            throw httpError.forbidden("Bạn không có quyền upload lại file trong kho");
        }
        const { dossier, file } = await loadArchivedFileForWarehouse(
            profile,
            input.dossierId,
            input.fileId,
            Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
        );

        const rawPrefix = getRawStoragePrefix();
        let nextFilePath = file.filePath;
        let nextFileName = file.fileName;
        let nextSizeKb = file.fileSizeKb;

        if (input.key?.trim()) {
            const stagedKey = normalizeStorageKey(input.key.trim());
            const stagingPrefix = `${rawPrefix}/warehouse-reupload/${dossier.id}/`;
            if (!stagedKey.startsWith(stagingPrefix) && !stagedKey.startsWith(`${rawPrefix}/`)) {
                throw httpError.badRequest("File upload phải nằm trong thư mục raw/");
            }

            nextFileName = storageBasename(stagedKey) || file.fileName;
            nextFilePath = resolveWorkingFilePath({
                folderPath: dossier.folderPath,
                currentFilePath: file.filePath,
                fileName: nextFileName,
            });

            await copyStorageObject(stagedKey, nextFilePath);
            const { size } = await statStorageObject(nextFilePath);
            nextSizeKb = Math.max(1, Math.ceil(size / 1024));

            if (
                nextFilePath !== normalizeStorageKey(file.filePath) &&
                !isProtectedArchivalKey(file.filePath)
            ) {
                await deleteStorageObjectQuiet(file.filePath);
            }

            await db
                .update(dossierFiles)
                .set({
                    fileName: nextFileName,
                    filePath: nextFilePath,
                    fileSizeKb: nextSizeKb,
                })
                .where(eq(dossierFiles.id, file.id));
        }

        const reopen = await reopenDossierForOcr({
            dossierId: dossier.id,
            actorId: profile.id,
            notes: `Reupload file ${file.fileName} (fileId=${file.id})`,
        });

        return {
            dossierId: dossier.id,
            fileId: file.id,
            file: {
                id: file.id,
                fileName: nextFileName,
                filePath: nextFilePath,
                fileSizeKb: nextSizeKb,
            },
            status: reopen.status,
            fromStatus: reopen.fromStatus,
            message:
                "Đã cập nhật file và mở lại OCR cho hồ sơ này. Hồ sơ chuyển sang trạng thái NEW để AI OCR chạy lại.",
        };
    },

    async deleteFile(
        profile: UserWithRoles,
        input: { dossierId: string; fileId: string },
    ) {
        if (!hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_DELETE)) {
            throw httpError.forbidden("Bạn không có quyền xóa file trong kho");
        }
        const { dossier, file } = await loadArchivedFileForWarehouse(
            profile,
            input.dossierId,
            input.fileId,
            Permission.ARCHIVE_WAREHOUSE_DELETE,
        );

        const [{ value: fileCount }] = await db
            .select({ value: count() })
            .from(dossierFiles)
            .where(eq(dossierFiles.dossierId, dossier.id));

        if (Number(fileCount) <= 1) {
            throw httpError.badRequest("Không thể xóa file cuối cùng của hồ sơ");
        }

        await db.delete(dossierFiles).where(eq(dossierFiles.id, file.id));
        if (!isProtectedArchivalKey(file.filePath)) {
            await deleteStorageObjectQuiet(file.filePath);
        }

        const reopen = await reopenDossierForOcr({
            dossierId: dossier.id,
            actorId: profile.id,
            notes: `Deleted file ${file.fileName} (fileId=${file.id})`,
        });

        return {
            dossierId: dossier.id,
            deletedFileId: file.id,
            status: reopen.status,
            message:
                "Đã xóa file và mở lại OCR cho hồ sơ. Hồ sơ chuyển sang trạng thái NEW.",
        };
    },

    async moveFile(
        profile: UserWithRoles,
        input: { dossierId: string; fileId: string; targetDossierId: string },
    ) {
        if (!hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_EDIT)) {
            throw httpError.forbidden("Bạn không có quyền chuyển file trong kho");
        }
        if (input.dossierId === input.targetDossierId) {
            throw httpError.badRequest("Hồ sơ đích phải khác hồ sơ nguồn");
        }

        const { dossier: source, file } = await loadArchivedFileForWarehouse(
            profile,
            input.dossierId,
            input.fileId,
            Permission.ARCHIVE_WAREHOUSE_EDIT,
        );
        const target = await loadArchivedDossierForWarehouse(
            profile,
            input.targetDossierId,
            Permission.ARCHIVE_WAREHOUSE_EDIT,
        );

        const [{ value: sourceCount }] = await db
            .select({ value: count() })
            .from(dossierFiles)
            .where(eq(dossierFiles.dossierId, source.id));

        if (Number(sourceCount) <= 1) {
            throw httpError.badRequest("Không thể chuyển file cuối cùng khỏi hồ sơ nguồn");
        }

        const destPath = resolveWorkingFilePath({
            folderPath: target.folderPath,
            currentFilePath: `${normalizeStorageKey(target.folderPath)}/${file.fileName}`,
            fileName: file.fileName,
        });

        await copyStorageObject(file.filePath, destPath);
        const { size } = await statStorageObject(destPath);
        const fileSizeKb = Math.max(1, Math.ceil(size / 1024));

        await db
            .update(dossierFiles)
            .set({
                dossierId: target.id,
                filePath: destPath,
                fileSizeKb,
            })
            .where(eq(dossierFiles.id, file.id));

        if (
            normalizeStorageKey(file.filePath) !== destPath &&
            !isProtectedArchivalKey(file.filePath)
        ) {
            await deleteStorageObjectQuiet(file.filePath);
        }

        const [sourceReopen, targetReopen] = await Promise.all([
            reopenDossierForOcr({
                dossierId: source.id,
                actorId: profile.id,
                notes: `Moved file ${file.fileName} to dossier ${target.id}`,
            }),
            reopenDossierForOcr({
                dossierId: target.id,
                actorId: profile.id,
                notes: `Received file ${file.fileName} from dossier ${source.id}`,
            }),
        ]);

        return {
            sourceDossierId: source.id,
            targetDossierId: target.id,
            fileId: file.id,
            sourceStatus: sourceReopen.status,
            targetStatus: targetReopen.status,
            message:
                "Đã chuyển file. Cả hai hồ sơ đã mở lại OCR (status NEW).",
        };
    },
};

async function copyStorageObject(sourceKey: string, destKey: string): Promise<string> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    const src = normalizeStorageKey(sourceKey);
    const dest = normalizeStorageKey(destKey);
    if (isProtectedArchivalKey(dest)) {
        throw httpError.badRequest("Không thể ghi đè object trong AIP");
    }
    const conditions = new CopyConditions();
    await s3.getMinIOClient().copyObject(
        bucket,
        dest,
        `/${bucket}/${src}`,
        conditions,
    );
    return dest;
}

async function deleteStorageObjectQuiet(objectName: string): Promise<void> {
    const key = normalizeStorageKey(objectName);
    if (!key || isProtectedArchivalKey(key)) return;
    const s3 = await getS3Client();
    if (!s3) return;
    const bucket = env.S3?.bucket;
    if (!bucket) return;
    try {
        await s3.deleteFile({ bucket, objectName: key });
    } catch (error) {
        console.warn("[Warehouse] Failed to delete storage object:", key, error);
    }
}

async function loadArchivedDossierForWarehouse(
    profile: UserWithRoles,
    dossierId: string,
    warehousePermission: string,
) {
    const scope = await ArchiveScopeResolver.resolve(profile, {
        warehousePermission,
    });
    if (scope.mode === "none") {
        throw httpError.forbidden("Bạn không có quyền truy cập hồ sơ này trong kho");
    }

    const [dossier] = await db
        .select({
            id: dossiers.id,
            name: dossiers.name,
            folderPath: dossiers.folderPath,
            status: dossiers.status,
            projectCode: dossiers.projectCode,
            fondId: dossiers.fondId,
            dossierTypeId: dossiers.dossierTypeId,
            currentMetadataKey: dossiers.currentMetadataKey,
            ocrMetadataKey: dossiers.ocrMetadataKey,
        })
        .from(dossiers)
        .where(activeDossierWhere(eq(dossiers.id, dossierId)))
        .limit(1);

    if (!dossier) {
        throw httpError.notFound("Không tìm thấy hồ sơ");
    }

    if (!(WAREHOUSE_DOSSIER_STATUSES as ReadonlyArray<string>).includes(dossier.status)) {
        throw httpError.notFound("Hồ sơ chưa được lưu kho");
    }

    assertFondAccess(scope, dossier.fondId ?? undefined);
    assertDossierTypeAccess(scope, dossier.dossierTypeId);

    return dossier;
}

async function loadArchivedFileForWarehouse(
    profile: UserWithRoles,
    dossierId: string,
    fileId: string,
    warehousePermission: string = Permission.ARCHIVE_WAREHOUSE_READ,
) {
    const scope = await ArchiveScopeResolver.resolve(profile, {
        warehousePermission,
    });
    if (scope.mode === "none") {
        throw httpError.forbidden("Bạn không có quyền truy cập hồ sơ này trong kho");
    }

    const [dossier] = await db
        .select({
            id: dossiers.id,
            name: dossiers.name,
            folderPath: dossiers.folderPath,
            status: dossiers.status,
            projectCode: dossiers.projectCode,
            fondId: dossiers.fondId,
            dossierTypeId: dossiers.dossierTypeId,
            currentMetadataKey: dossiers.currentMetadataKey,
            ocrMetadataKey: dossiers.ocrMetadataKey,
        })
        .from(dossiers)
        .where(activeDossierWhere(eq(dossiers.id, dossierId)))
        .limit(1);

    if (!dossier) {
        throw httpError.notFound("Không tìm thấy hồ sơ");
    }

    if (!(WAREHOUSE_DOSSIER_STATUSES as ReadonlyArray<string>).includes(dossier.status)) {
        throw httpError.notFound("Hồ sơ chưa được lưu kho");
    }

    assertFondAccess(scope, dossier.fondId ?? undefined);
    assertDossierTypeAccess(scope, dossier.dossierTypeId);

    const [file] = await db
        .select({
            id: dossierFiles.id,
            fileName: dossierFiles.fileName,
            filePath: dossierFiles.filePath,
            fileSizeKb: dossierFiles.fileSizeKb,
            dossierId: dossierFiles.dossierId,
        })
        .from(dossierFiles)
        .where(and(
            eq(dossierFiles.id, fileId),
            eq(dossierFiles.dossierId, dossier.id),
        ))
        .limit(1);

    if (!file) {
        throw httpError.notFound("Không tìm thấy văn bản trong hồ sơ");
    }

    return { dossier, file };
}
