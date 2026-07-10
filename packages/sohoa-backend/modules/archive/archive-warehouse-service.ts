import { httpError } from "@shared/common-lib";
import {
    and,
    desc,
    eq,
    ilike,
    inArray,
    isNull,
    or,
    sql,
    type SQL,
} from "drizzle-orm";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { db } from "../../db/db-conn.ts";
import { archiveSubmissions } from "../../db/schemas/archive-submission.ts";
import type { ArchiveFieldConfigSnapshot, ArchiveFieldValueSnapshot } from "../../db/schemas/archive-submission.ts";
import { ArchiveSubmissionStatus } from "../../db/schemas/archive-constants.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { fonds } from "../../db/schemas/fond.ts";
import { inventories } from "../../db/schemas/inventory.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import {
    ArchiveScopeResolver,
    type ArchiveDataScope,
} from "../archive-permission/archive-scope-resolver.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";

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
    const scope = await ArchiveScopeResolver.resolve(profile, {
        warehousePermission: Permission.ARCHIVE_WAREHOUSE_READ,
    });
    return {
        scope,
        fondScope: scope.mode === "fond" ? scope.fondIds : null,
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
    if (scope.mode === "fond" && !scope.fondIds.includes(trimmed)) {
        throw httpError.forbidden("Bạn không có quyền truy cập phông này");
    }
    return trimmed;
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

function buildArchivedDossierWhere(
    fondId: string,
    status: WarehouseDossierStatus,
    search?: string,
    year?: number,
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
    async getFondSummary(
        profile: UserWithRoles,
        fondId: string,
        statusInput?: string,
    ) {
        const { scope, fondScope } = await resolveWarehouseScope(profile);
        const effectiveFondId = assertFondAccess(scope, fondId);
        const status = resolveWarehouseStatus(statusInput);

        const whereClause = buildArchivedDossierWhere(effectiveFondId, status);

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
        const [submissionMap, docStatsMap] = await Promise.all([
            loadLatestApprovedSubmissions(dossierIds),
            loadDocumentStatsByDossierIds(dossierIds),
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
                updatedAt: dossiers.updatedAt,
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

        const submissionMap = await loadLatestApprovedSubmissions([dossier.id]);
        const submission = submissionMap.get(dossier.id);
        const docStatsMap = await loadDocumentStatsByDossierIds([dossier.id]);
        const docStats = docStatsMap.get(dossier.id);

        const files = await db
            .select({
                id: dossierFiles.id,
                fileName: dossierFiles.fileName,
                fileSizeKb: dossierFiles.fileSizeKb,
                createdAt: dossierFiles.createdAt,
            })
            .from(dossierFiles)
            .where(eq(dossierFiles.dossierId, dossier.id))
            .orderBy(dossierFiles.fileName);

        return {
            dossier: {
                ...dossier,
                documentCount: docStats?.documentCount ?? 0,
                totalSizeKb: docStats?.totalSizeKb ?? 0,
                archivedAt: submission?.reviewedAt ?? null,
                archiveYear: submission?.archiveYear ?? null,
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
        };
    },
};
