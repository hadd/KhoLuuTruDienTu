import {
    and,
    desc,
    eq,
    exists,
    ilike,
    inArray,
    isNull,
    or,
    sql,
    type SQL,
} from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { ArchiveSubmissionStatus } from "../../db/schemas/archive-constants.ts";
import {
    ACTIVE_DISPOSAL_CATALOG_STATUSES,
    DisposalProposalCatalogStatus,
    type DisposalProposalItemSourceType,
} from "../../db/schemas/archive-disposal-constants.ts";
import {
    disposalProposalCatalogs,
    disposalProposalItems,
    duplicateDetectionRules,
} from "../../db/schemas/archive-disposal.ts";
import { archiveSubmissions } from "../../db/schemas/archive-submission.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { documentTypes } from "../../db/schemas/document-type.ts";
import { dossierPhysicalPlacements } from "../../db/schemas/dossier-physical-placement.ts";
import { DossierPhysicalPlacementStatus } from "../../db/schemas/dossier-physical-placement-constants.ts";
import { dossierTypes } from "../../db/schemas/dossier-type.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { fonds } from "../../db/schemas/fond.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import {
    assertCanAccessDisposalCatalog,
    type DisposalCatalogListScope,
} from "./archive-disposal-catalog-access.ts";
import {
    detectDuplicateMatches,
    extractDossierCodeFromFieldValues,
    type DuplicateCandidateRecord,
} from "../../libs/duplicate-detection.ts";
import {
    classifyRetentionStatus,
    computeRetentionExpiresAt,
    isRetentionCandidateStatus,
    type RetentionExpiryStatus,
} from "../../libs/retention-expiry.ts";
import { resolveDossierEffectiveRetentionBatch } from "../../libs/retention-dossier.ts";
import type { ArchiveDataScope } from "../archive-permission/index.ts";
import { resolveWarehouseScope } from "../archive/archive-warehouse-service.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { collectDescendantItemIds } from "../physical-warehouse/physical-warehouse-service.ts";
import { assertCouncilReviewWorkflowEnabled } from "./disposal-settings-utils.ts";

export type DisposalCandidateCategory =
    | "all"
    | "expiring_soon"
    | "expired"
    | "duplicate";

export type DisposalCandidateEntityKind = "dossier" | "document" | "grouped";

export type ListDisposalCandidatesQuery = {
    category?: DisposalCandidateCategory;
    entityKind?: DisposalCandidateEntityKind;
    fondId?: string;
    dossierTypeId?: string;
    documentTypeId?: string;
    inventoryId?: string;
    retentionPeriodId?: string;
    physicalItemId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: number;
    limit?: number;
    includeInCatalog?: boolean;
};

type ArchivedDossierRow = {
    id: string;
    name: string;
    fondId: string | null;
    fondName: string | null;
    dossierTypeId: string | null;
    dossierTypeName: string | null;
    reviewedAt: Date;
    inventoryId: string | null;
    fieldValues: Record<string, unknown>;
};

type CandidateGroup = {
    dossierId: string;
    dossierName: string;
    fondId: string | null;
    fondName: string | null;
    dossierTypeId: string | null;
    dossierTypeName: string | null;
    retentionPeriodId: string | null;
    retentionPeriodName: string | null;
    archivedAt: string | null;
    expiresAt: string | null;
    retentionStatus: RetentionExpiryStatus;
    dossierItem: CandidateItem | null;
    documentItems: CandidateItem[];
};

type CandidateItem = {
    entityKind: DisposalCandidateEntityKind;
    dossierId: string;
    fileId: string | null;
    dossierName: string;
    fondId: string | null;
    fondName: string | null;
    dossierTypeId: string | null;
    dossierTypeName: string | null;
    fileName: string | null;
    retentionPeriodId: string | null;
    retentionPeriodName: string | null;
    archivedAt: string | null;
    expiresAt: string | null;
    retentionStatus: RetentionExpiryStatus;
    categories: Array<"expiring_soon" | "expired" | "duplicate">;
    duplicateGroupId: string | null;
    duplicateCriteria: string[];
    duplicatePeerCount: number;
    disposalCatalogStatus: string | null;
    disposalCatalogId: string | null;
};

function documentTypeScopeCondition(documentTypeIds: string[]): SQL {
    return sql`exists (
        select 1 from ${dossierFiles} f
        where f.dossier_id = ${dossiers.id}
          and f.document_type_id in (${
        sql.join(documentTypeIds.map((id) => sql`${id}`), sql`, `)
    })
    )`;
}

function dossierTypeScopeCondition(dossierTypeIds: string[]): SQL {
    return or(
        inArray(dossiers.dossierTypeId, dossierTypeIds),
        sql`exists (
            select 1 from ${archiveSubmissions} s
            where s.dossier_id = ${dossiers.id}
              and s.status = ${ArchiveSubmissionStatus.APPROVED}
              and (s.field_values->>'dossier_type') in (${
            sql.join(dossierTypeIds.map((id) => sql`${id}`), sql`, `)
        })
        )`,
    )!;
}

async function buildScopeWhere(
    scope: ArchiveDataScope,
    filters: ListDisposalCandidatesQuery,
): Promise<SQL> {
    const conditions: SQL[] = [
        eq(dossiers.status, DossierStatus.ARCHIVED),
        exists(
            db.select({ one: sql`1` })
                .from(archiveSubmissions)
                .where(and(
                    eq(archiveSubmissions.dossierId, dossiers.id),
                    eq(archiveSubmissions.status, ArchiveSubmissionStatus.APPROVED),
                )),
        ),
    ];

    if (scope.mode === "none") {
        return sql`false`;
    }
    if (scope.mode === "scoped" || scope.mode === "fond") {
        if (scope.fondIds.length === 0) {
            return sql`false`;
        }
        conditions.push(inArray(dossiers.fondId, scope.fondIds));
        if (scope.mode === "scoped") {
            if (scope.dossierTypeIds.length > 0) {
                conditions.push(dossierTypeScopeCondition(scope.dossierTypeIds));
            }
            if (scope.documentTypeIds.length > 0) {
                conditions.push(documentTypeScopeCondition(scope.documentTypeIds));
            }
        }
    }

    if (filters.fondId?.trim()) {
        conditions.push(eq(dossiers.fondId, filters.fondId.trim()));
    }
    if (filters.dossierTypeId?.trim()) {
        conditions.push(dossierTypeScopeCondition([filters.dossierTypeId.trim()]));
    }
    if (filters.documentTypeId?.trim()) {
        conditions.push(documentTypeScopeCondition([filters.documentTypeId.trim()]));
    }
    if (filters.inventoryId?.trim()) {
        conditions.push(sql`exists (
            select 1 from ${archiveSubmissions} s
            where s.dossier_id = ${dossiers.id}
              and s.status = ${ArchiveSubmissionStatus.APPROVED}
              and (s.field_values->>'inventory') = ${filters.inventoryId.trim()}
        )`);
    }
    if (filters.physicalItemId?.trim()) {
        const physicalItemIds = await collectDescendantItemIds(
            filters.physicalItemId.trim(),
        );
        if (physicalItemIds.length === 0) {
            conditions.push(sql`false`);
        } else {
            conditions.push(sql`exists (
                select 1 from ${dossierPhysicalPlacements} p
                where p.dossier_id = ${dossiers.id}
                  and p.status = ${DossierPhysicalPlacementStatus.ACTIVE}
                  and p.physical_item_id in (${
                sql.join(physicalItemIds.map((id) => sql`${id}`), sql`, `)
            })
            )`);
        }
    }

    const search = filters.search?.trim();
    if (search) {
        const pattern = `%${search}%`;
        conditions.push(or(
            ilike(dossiers.name, pattern),
            ilike(dossiers.folderPath, pattern),
            ilike(fonds.fondName, pattern),
            sql`exists (
                select 1 from ${archiveSubmissions} s
                where s.dossier_id = ${dossiers.id}
                  and s.status = ${ArchiveSubmissionStatus.APPROVED}
                  and (
                    coalesce(s.field_values->>'dossier_code', '') ilike ${pattern}
                    or coalesce(s.field_values->>'ma_ho_so', '') ilike ${pattern}
                  )
            )`,
            sql`exists (
                select 1 from ${dossierFiles} f
                where f.dossier_id = ${dossiers.id}
                  and f.file_name ilike ${pattern}
            )`,
        )!);
    }

    return activeDossierWhere(and(...conditions));
}

async function loadArchivedDossierRows(
    scope: ArchiveDataScope,
    filters: ListDisposalCandidatesQuery,
): Promise<ArchivedDossierRow[]> {
    const where = await buildScopeWhere(scope, filters);
    if (where === sql`false`) return [];

    const rows = await db
        .select({
            id: dossiers.id,
            name: dossiers.name,
            fondId: dossiers.fondId,
            fondName: fonds.fondName,
            dossierTypeId: dossiers.dossierTypeId,
            dossierTypeName: dossierTypes.name,
        })
        .from(dossiers)
        .leftJoin(fonds, and(eq(fonds.id, dossiers.fondId), isNull(fonds.deletedAt)))
        .leftJoin(dossierTypes, eq(dossierTypes.id, dossiers.dossierTypeId))
        .where(where);

    if (rows.length === 0) return [];

    const dossierIds = rows.map((r) => r.id);
    const submissionRows = await db
        .selectDistinctOn([archiveSubmissions.dossierId], {
            dossierId: archiveSubmissions.dossierId,
            reviewedAt: archiveSubmissions.reviewedAt,
            fieldValues: archiveSubmissions.fieldValues,
            inventoryId: sql<string | null>`${archiveSubmissions.fieldValues}->>'inventory'`,
        })
        .from(archiveSubmissions)
        .where(and(
            inArray(archiveSubmissions.dossierId, dossierIds),
            eq(archiveSubmissions.status, ArchiveSubmissionStatus.APPROVED),
        ))
        .orderBy(archiveSubmissions.dossierId, desc(archiveSubmissions.reviewedAt));

    const submissionByDossier = new Map(
        submissionRows.map((row) => [row.dossierId, row]),
    );

    return rows.flatMap((row) => {
            const submission = submissionByDossier.get(row.id);
            if (!submission?.reviewedAt) return [];
            return [{
                ...row,
                reviewedAt: submission.reviewedAt,
                inventoryId: submission.inventoryId,
                fieldValues: submission.fieldValues as Record<string, unknown>,
            }];
        });
}

async function loadActiveDisposalEntries(dossierIds: string[]): Promise<{
    dossierLevel: Map<string, { catalogId: string; status: string }>;
    fileLevel: Map<string, { catalogId: string; status: string }>;
}> {
    const dossierLevel = new Map<string, { catalogId: string; status: string }>();
    const fileLevel = new Map<string, { catalogId: string; status: string }>();
    if (dossierIds.length === 0) {
        return { dossierLevel, fileLevel };
    }

    const rows = await db
        .select({
            dossierId: disposalProposalItems.dossierId,
            fileId: disposalProposalItems.fileId,
            catalogId: disposalProposalItems.catalogId,
            status: disposalProposalCatalogs.status,
        })
        .from(disposalProposalItems)
        .innerJoin(
            disposalProposalCatalogs,
            eq(disposalProposalCatalogs.id, disposalProposalItems.catalogId),
        )
        .where(and(
            inArray(disposalProposalItems.dossierId, dossierIds),
            inArray(disposalProposalCatalogs.status, [...ACTIVE_DISPOSAL_CATALOG_STATUSES]),
        ));

    for (const row of rows) {
        const info = { catalogId: row.catalogId, status: row.status };
        if (row.fileId == null) {
            dossierLevel.set(row.dossierId, info);
        } else {
            fileLevel.set(row.fileId, info);
        }
    }
    return { dossierLevel, fileLevel };
}

async function loadDuplicateRules() {
    return db.select().from(duplicateDetectionRules);
}

function parseDateBoundary(value?: string, endOfDay = false): Date | null {
    if (!value?.trim()) return null;
    const date = new Date(value.trim());
    if (Number.isNaN(date.getTime())) return null;
    if (endOfDay) {
        date.setHours(23, 59, 59, 999);
    }
    return date;
}

function matchesDateRange(
    expiresAt: Date | null,
    archivedAt: Date | null,
    dateFrom?: string,
    dateTo?: string,
): boolean {
    const from = parseDateBoundary(dateFrom);
    const to = parseDateBoundary(dateTo, true);
    const target = expiresAt ?? archivedAt;
    if (!target) return !from && !to;
    if (from && target.getTime() < from.getTime()) return false;
    if (to && target.getTime() > to.getTime()) return false;
    return true;
}

function generateCatalogCode(): string {
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `DLT-${stamp}-${suffix}`;
}

export const ArchiveDisposalService = {
    async listCandidates(profile: UserWithRoles, query: ListDisposalCandidatesQuery) {
        const { scope, fondScope } = await resolveWarehouseScope(profile);
        if (scope.mode === "none") {
            return {
                items: [] as CandidateItem[],
                page: query.page ?? 1,
                limit: query.limit ?? 20,
                total: 0,
                totalPages: 1,
                fondScope,
                message: "Bạn chưa được phân quyền phông nào",
            };
        }

        const category = query.category ?? "all";
        const entityKind = query.entityKind ?? "dossier";
        const page = Math.max(query.page ?? 1, 1);
        const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
        const includeInCatalog = query.includeInCatalog === true;

        const dossierRows = await loadArchivedDossierRows(scope, query);
        if (dossierRows.length === 0) {
            return {
                items: [],
                page,
                limit,
                total: 0,
                totalPages: 1,
                fondScope,
                message: "Không có dữ liệu",
            };
        }

        const dossierIds = dossierRows.map((r) => r.id);
        const [retentionByDossier, activeDisposal, fileRows, rules] = await Promise.all([
            resolveDossierEffectiveRetentionBatch(dossierIds),
            loadActiveDisposalEntries(dossierIds),
            db.select({
                id: dossierFiles.id,
                dossierId: dossierFiles.dossierId,
                fileName: dossierFiles.fileName,
                fileSizeKb: dossierFiles.fileSizeKb,
                documentTypeId: dossierFiles.documentTypeId,
            }).from(dossierFiles).where(inArray(dossierFiles.dossierId, dossierIds)),
            loadDuplicateRules(),
        ]);

        const enabledRules = new Set(
            rules.filter((r) => r.isEnabled).map((r) => r.ruleKey),
        );
        const dossierCodeFieldKey = rules.find((r) =>
            r.ruleKey === "DOSSIER_CODE"
        )?.dossierCodeFieldKey ?? "dossier_code";

        const duplicateRecords: DuplicateCandidateRecord[] = [];
        for (const row of dossierRows) {
            duplicateRecords.push({
                dossierId: row.id,
                dossierName: row.name,
                hoSoId: row.name,
                dossierCode: extractDossierCodeFromFieldValues(
                    row.fieldValues,
                    dossierCodeFieldKey,
                ),
            });
            for (const file of fileRows.filter((f) => f.dossierId === row.id)) {
                duplicateRecords.push({
                    dossierId: row.id,
                    fileId: file.id,
                    dossierName: row.name,
                    hoSoId: row.name,
                    dossierCode: extractDossierCodeFromFieldValues(
                        row.fieldValues,
                        dossierCodeFieldKey,
                    ),
                    fileName: file.fileName,
                    fileSizeKb: file.fileSizeKb,
                });
            }
        }
        const duplicateMatches = detectDuplicateMatches(
            duplicateRecords,
            enabledRules,
            dossierCodeFieldKey,
        );

        const candidates: CandidateItem[] = [];
        const groupMap = new Map<string, CandidateGroup>();

        function ensureGroup(
            row: ArchivedDossierRow,
            retention: { id: string; label: string; isPermanent?: boolean } | null,
            reviewedAt: Date,
            expiresAt: Date | null,
            retentionStatus: RetentionExpiryStatus,
        ): CandidateGroup {
            let group = groupMap.get(row.id);
            if (!group) {
                group = {
                    dossierId: row.id,
                    dossierName: row.name,
                    fondId: row.fondId,
                    fondName: row.fondName,
                    dossierTypeId: row.dossierTypeId,
                    dossierTypeName: row.dossierTypeName,
                    retentionPeriodId: retention?.id ?? null,
                    retentionPeriodName: retention?.label ?? null,
                    archivedAt: reviewedAt.toISOString(),
                    expiresAt: expiresAt?.toISOString() ?? null,
                    retentionStatus,
                    dossierItem: null,
                    documentItems: [],
                };
                groupMap.set(row.id, group);
            }
            return group;
        }

        const includeDossierItems = entityKind === "dossier" || entityKind === "grouped";
        const includeDocumentItems = entityKind === "document" || entityKind === "grouped";

        for (const row of dossierRows) {
            const retention = retentionByDossier.get(row.id) ?? null;
            const reviewedAt = row.reviewedAt!;
            const expiresAt = retention
                ? computeRetentionExpiresAt(reviewedAt, retention)
                : null;
            const retentionStatus = classifyRetentionStatus(expiresAt, {
                isPermanent: retention?.isPermanent,
            });

            const dossierDisposal = activeDisposal.dossierLevel.get(row.id);
            const dossierDuplicate = duplicateMatches.get(`dossier:${row.id}`);
            const categories: Array<"expiring_soon" | "expired" | "duplicate"> = [];
            if (retentionStatus === "EXPIRING_SOON") categories.push("expiring_soon");
            if (retentionStatus === "EXPIRED") categories.push("expired");
            if (dossierDuplicate) categories.push("duplicate");

            if (includeDossierItems) {
                if (dossierDisposal && !includeInCatalog) {
                    // skip dossier-level item only
                } else if (
                    (category !== "expiring_soon" || retentionStatus === "EXPIRING_SOON") &&
                    (category !== "expired" || retentionStatus === "EXPIRED") &&
                    (category !== "duplicate" || Boolean(dossierDuplicate)) &&
                    (category !== "all" || categories.length > 0) &&
                    (!query.retentionPeriodId?.trim() ||
                        retention?.id === query.retentionPeriodId.trim()) &&
                    matchesDateRange(expiresAt, reviewedAt, query.dateFrom, query.dateTo)
                ) {
                    const dossierItem: CandidateItem = {
                        entityKind: "dossier",
                        dossierId: row.id,
                        fileId: null,
                        dossierName: row.name,
                        fondId: row.fondId,
                        fondName: row.fondName,
                        dossierTypeId: row.dossierTypeId,
                        dossierTypeName: row.dossierTypeName,
                        fileName: null,
                        retentionPeriodId: retention?.id ?? null,
                        retentionPeriodName: retention?.label ?? null,
                        archivedAt: reviewedAt.toISOString(),
                        expiresAt: expiresAt?.toISOString() ?? null,
                        retentionStatus,
                        categories,
                        duplicateGroupId: dossierDuplicate?.duplicateGroupId ?? null,
                        duplicateCriteria: dossierDuplicate?.duplicateCriteria ?? [],
                        duplicatePeerCount: dossierDuplicate?.duplicatePeerCount ?? 0,
                        disposalCatalogStatus: dossierDisposal?.status ?? null,
                        disposalCatalogId: dossierDisposal?.catalogId ?? null,
                    };

                    if (entityKind === "dossier") {
                        candidates.push(dossierItem);
                    } else {
                        ensureGroup(row, retention, reviewedAt, expiresAt, retentionStatus)
                            .dossierItem = dossierItem;
                    }
                }
            }

            if (includeDocumentItems) {
                const dossierFilesForRow = fileRows.filter((f) => f.dossierId === row.id);
                for (const file of dossierFilesForRow) {
                    if (dossierDisposal && !includeInCatalog) continue;

                    const fileDisposal = activeDisposal.fileLevel.get(file.id);
                    if (fileDisposal && !includeInCatalog) continue;

                    const fileDuplicate = duplicateMatches.get(`file:${file.id}`);
                    const fileCategories: Array<"expiring_soon" | "expired" | "duplicate"> = [];
                    if (isRetentionCandidateStatus(retentionStatus)) {
                        if (retentionStatus === "EXPIRING_SOON") {
                            fileCategories.push("expiring_soon");
                        }
                        if (retentionStatus === "EXPIRED") {
                            fileCategories.push("expired");
                        }
                    }
                    if (fileDuplicate) fileCategories.push("duplicate");

                    if (category === "expiring_soon" && !fileCategories.includes("expiring_soon")) {
                        continue;
                    }
                    if (category === "expired" && !fileCategories.includes("expired")) continue;
                    if (category === "duplicate" && !fileDuplicate) continue;
                    if (category === "all" && fileCategories.length === 0) continue;

                    if (query.documentTypeId?.trim() &&
                        file.documentTypeId !== query.documentTypeId.trim()) {
                        continue;
                    }
                    if (query.retentionPeriodId?.trim() &&
                        retention?.id !== query.retentionPeriodId.trim()) {
                        continue;
                    }
                    if (!matchesDateRange(expiresAt, reviewedAt, query.dateFrom, query.dateTo)) {
                        continue;
                    }

                    const documentItem: CandidateItem = {
                        entityKind: "document",
                        dossierId: row.id,
                        fileId: file.id,
                        dossierName: row.name,
                        fondId: row.fondId,
                        fondName: row.fondName,
                        dossierTypeId: row.dossierTypeId,
                        dossierTypeName: row.dossierTypeName,
                        fileName: file.fileName,
                        retentionPeriodId: retention?.id ?? null,
                        retentionPeriodName: retention?.label ?? null,
                        archivedAt: reviewedAt.toISOString(),
                        expiresAt: expiresAt?.toISOString() ?? null,
                        retentionStatus,
                        categories: fileCategories,
                        duplicateGroupId: fileDuplicate?.duplicateGroupId ?? null,
                        duplicateCriteria: fileDuplicate?.duplicateCriteria ?? [],
                        duplicatePeerCount: fileDuplicate?.duplicatePeerCount ?? 0,
                        disposalCatalogStatus: fileDisposal?.status ?? null,
                        disposalCatalogId: fileDisposal?.catalogId ?? null,
                    };

                    if (entityKind === "document") {
                        candidates.push(documentItem);
                    } else {
                        ensureGroup(row, retention, reviewedAt, expiresAt, retentionStatus)
                            .documentItems.push(documentItem);
                    }
                }
            }
        }

        if (entityKind === "grouped") {
            const groups = Array.from(groupMap.values())
                .filter((group) => group.dossierItem || group.documentItems.length > 0)
                .sort((a, b) => a.dossierName.localeCompare(b.dossierName, "vi"));
            const total = groups.length;
            const totalPages = Math.max(1, Math.ceil(total / limit));
            const offset = (page - 1) * limit;
            const paginatedGroups = groups.slice(offset, offset + limit);

            return {
                items: [],
                groups: paginatedGroups,
                page,
                limit,
                total,
                totalPages,
                fondScope,
                message: total === 0 ? "Không có dữ liệu" : undefined,
            };
        }

        const total = candidates.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const offset = (page - 1) * limit;
        const items = candidates.slice(offset, offset + limit);

        return {
            items,
            page,
            limit,
            total,
            totalPages,
            fondScope,
            message: total === 0 ? "Không có dữ liệu" : undefined,
        };
    },

    async listCatalogs(
        profile: UserWithRoles,
        query: { page?: number; limit?: number },
        scope: DisposalCatalogListScope,
    ) {
        const page = Math.max(query.page ?? 1, 1);
        const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
        const offset = (page - 1) * limit;

        const scopeFilter = scope.mode === "member_only"
            ? inArray(disposalProposalCatalogs.id, scope.catalogIds)
            : undefined;

        const rows = await db
            .select({
                id: disposalProposalCatalogs.id,
                code: disposalProposalCatalogs.code,
                name: disposalProposalCatalogs.name,
                catalogDate: disposalProposalCatalogs.catalogDate,
                notes: disposalProposalCatalogs.notes,
                status: disposalProposalCatalogs.status,
                createdBy: disposalProposalCatalogs.createdBy,
                creatorName: userProfiles.fullName,
                createdAt: disposalProposalCatalogs.createdAt,
                updatedAt: disposalProposalCatalogs.updatedAt,
            })
            .from(disposalProposalCatalogs)
            .innerJoin(userProfiles, eq(userProfiles.id, disposalProposalCatalogs.createdBy))
            .where(scopeFilter)
            .orderBy(desc(disposalProposalCatalogs.updatedAt))
            .limit(limit)
            .offset(offset);

        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(disposalProposalCatalogs)
            .where(scopeFilter);

        return {
            items: rows.map((row) => ({
                ...row,
                catalogDate: row.catalogDate.toISOString().slice(0, 10),
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
            })),
            page,
            limit,
            total: count ?? 0,
            totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
        };
    },

    async getCatalog(profile: UserWithRoles, catalogId: string) {
        await assertCanAccessDisposalCatalog(profile, catalogId);

        const [catalog] = await db
            .select({
                id: disposalProposalCatalogs.id,
                code: disposalProposalCatalogs.code,
                name: disposalProposalCatalogs.name,
                catalogDate: disposalProposalCatalogs.catalogDate,
                notes: disposalProposalCatalogs.notes,
                status: disposalProposalCatalogs.status,
                createdBy: disposalProposalCatalogs.createdBy,
                creatorName: userProfiles.fullName,
                createdAt: disposalProposalCatalogs.createdAt,
                updatedAt: disposalProposalCatalogs.updatedAt,
            })
            .from(disposalProposalCatalogs)
            .innerJoin(userProfiles, eq(userProfiles.id, disposalProposalCatalogs.createdBy))
            .where(eq(disposalProposalCatalogs.id, catalogId))
            .limit(1);

        if (!catalog) throw httpError.notFound("Không tìm thấy danh mục đề xuất hủy");

        const items = await db
            .select({
                id: disposalProposalItems.id,
                dossierId: disposalProposalItems.dossierId,
                fileId: disposalProposalItems.fileId,
                source: disposalProposalItems.source,
                reason: disposalProposalItems.reason,
                notes: disposalProposalItems.notes,
                dossierName: dossiers.name,
                fileName: dossierFiles.fileName,
                documentTypeName: documentTypes.name,
            })
            .from(disposalProposalItems)
            .innerJoin(dossiers, eq(dossiers.id, disposalProposalItems.dossierId))
            .leftJoin(dossierFiles, eq(dossierFiles.id, disposalProposalItems.fileId))
            .leftJoin(documentTypes, eq(documentTypes.id, dossierFiles.documentTypeId))
            .where(eq(disposalProposalItems.catalogId, catalogId));

        const dossiersWithDossierRow = new Set<string>();
        const dossiersWithDocumentRow = new Set<string>();
        for (const item of items) {
            if (item.fileId == null) {
                dossiersWithDossierRow.add(item.dossierId);
            } else {
                dossiersWithDocumentRow.add(item.dossierId);
            }
        }

        const referenceDossierIds = [...dossiersWithDossierRow].filter(
            (dossierId) => !dossiersWithDocumentRow.has(dossierId),
        );

        const referenceFilesByDossierId: Record<
            string,
            Array<{ fileId: string; fileName: string; documentTypeName: string | null }>
        > = {};

        if (referenceDossierIds.length > 0) {
            const referenceRows = await db
                .select({
                    dossierId: dossierFiles.dossierId,
                    fileId: dossierFiles.id,
                    fileName: dossierFiles.fileName,
                    documentTypeName: documentTypes.name,
                })
                .from(dossierFiles)
                .leftJoin(documentTypes, eq(documentTypes.id, dossierFiles.documentTypeId))
                .where(inArray(dossierFiles.dossierId, referenceDossierIds))
                .orderBy(dossierFiles.fileName);

            for (const row of referenceRows) {
                const list = referenceFilesByDossierId[row.dossierId] ?? [];
                list.push({
                    fileId: row.fileId,
                    fileName: row.fileName,
                    documentTypeName: row.documentTypeName,
                });
                referenceFilesByDossierId[row.dossierId] = list;
            }
        }

        return {
            catalog: {
                ...catalog,
                catalogDate: catalog.catalogDate.toISOString().slice(0, 10),
                createdAt: catalog.createdAt.toISOString(),
                updatedAt: catalog.updatedAt.toISOString(),
            },
            items,
            referenceFilesByDossierId,
        };
    },

    async createCatalog(
        profile: UserWithRoles,
        input: {
            name: string;
            catalogDate: string;
            notes?: string;
        },
    ) {
        await assertCouncilReviewWorkflowEnabled();

        const catalogDate = new Date(input.catalogDate);
        if (Number.isNaN(catalogDate.getTime())) {
            throw httpError.badRequest("Ngày lập không hợp lệ");
        }

        const [inserted] = await db.insert(disposalProposalCatalogs).values({
            code: generateCatalogCode(),
            name: input.name.trim(),
            catalogDate,
            notes: input.notes?.trim() ?? "",
            status: DisposalProposalCatalogStatus.DRAFT,
            createdBy: profile.id,
        }).returning();

        return inserted!;
    },

    async updateCatalog(
        profile: UserWithRoles,
        catalogId: string,
        input: {
            name?: string;
            catalogDate?: string;
            notes?: string | null;
        },
    ) {
        const [existing] = await db.select().from(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
        if (!existing) throw httpError.notFound("Không tìm thấy danh mục");
        if (existing.status !== DisposalProposalCatalogStatus.DRAFT) {
            throw httpError.conflict("Chỉ được sửa danh mục ở trạng thái Soạn thảo");
        }

        const patch: Partial<typeof disposalProposalCatalogs.$inferInsert> = {
            updatedAt: new Date(),
        };
        if (input.name !== undefined) patch.name = input.name.trim();
        if (input.notes !== undefined) patch.notes = input.notes?.trim() ?? "";
        if (input.catalogDate !== undefined) {
            const catalogDate = new Date(input.catalogDate);
            if (Number.isNaN(catalogDate.getTime())) {
                throw httpError.badRequest("Ngày lập không hợp lệ");
            }
            patch.catalogDate = catalogDate;
        }

        const [updated] = await db.update(disposalProposalCatalogs)
            .set(patch)
            .where(eq(disposalProposalCatalogs.id, catalogId))
            .returning();
        return updated!;
    },

    async deleteCatalog(_profile: UserWithRoles, catalogId: string) {
        const [existing] = await db.select().from(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
        if (!existing) throw httpError.notFound("Không tìm thấy danh mục");
        if (existing.status !== DisposalProposalCatalogStatus.DRAFT) {
            throw httpError.conflict("Chỉ được xóa danh mục ở trạng thái Soạn thảo");
        }

        await db.delete(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, catalogId));
    },

    async upsertCatalogItem(
        catalogId: string,
        input: {
            dossierId: string;
            fileId?: string | null;
            source: DisposalProposalItemSourceType;
            reason?: string;
            notes?: string;
        },
    ) {
        await assertCouncilReviewWorkflowEnabled();

        const [catalog] = await db.select().from(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
        if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");
        if (catalog.status !== DisposalProposalCatalogStatus.DRAFT) {
            throw httpError.conflict("Chỉ được sửa danh mục ở trạng thái Soạn thảo");
        }

        const existing = await db.query.disposalProposalItems.findFirst({
            where: and(
                eq(disposalProposalItems.catalogId, catalogId),
                eq(disposalProposalItems.dossierId, input.dossierId),
                input.fileId
                    ? eq(disposalProposalItems.fileId, input.fileId)
                    : isNull(disposalProposalItems.fileId),
            ),
        });
        if (existing) {
            throw httpError.conflict("Hồ sơ đã có trong danh mục");
        }

        const [inserted] = await db.insert(disposalProposalItems).values({
            catalogId,
            dossierId: input.dossierId,
            fileId: input.fileId ?? null,
            source: input.source,
            reason: input.reason?.trim() ?? "",
            notes: input.notes?.trim() ?? "",
        }).returning();

        return inserted!;
    },

    async updateCatalogItem(
        catalogId: string,
        itemId: string,
        input: { reason?: string; notes?: string | null },
    ) {
        const [catalog] = await db.select().from(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
        if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");
        if (catalog.status !== DisposalProposalCatalogStatus.DRAFT) {
            throw httpError.conflict("Chỉ được sửa danh mục ở trạng thái Soạn thảo");
        }

        const [updated] = await db.update(disposalProposalItems)
            .set({
                reason: input.reason?.trim(),
                notes: input.notes === undefined ? undefined : (input.notes?.trim() ?? ""),
                updatedAt: new Date(),
            })
            .where(and(
                eq(disposalProposalItems.id, itemId),
                eq(disposalProposalItems.catalogId, catalogId),
            ))
            .returning();

        if (!updated) throw httpError.notFound("Không tìm thấy hồ sơ trong danh mục");
        return updated;
    },

    async removeCatalogItem(catalogId: string, itemId: string) {
        const [catalog] = await db.select().from(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
        if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");
        if (catalog.status !== DisposalProposalCatalogStatus.DRAFT) {
            throw httpError.conflict("Chỉ được sửa danh mục ở trạng thái Soạn thảo");
        }

        await db.delete(disposalProposalItems).where(and(
            eq(disposalProposalItems.id, itemId),
            eq(disposalProposalItems.catalogId, catalogId),
        ));
    },

    async submitCatalog(_profile: UserWithRoles, catalogId: string) {
        await assertCouncilReviewWorkflowEnabled();

        const [existing] = await db.select().from(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
        if (!existing) throw httpError.notFound("Không tìm thấy danh mục");
        if (existing.status !== DisposalProposalCatalogStatus.DRAFT) {
            throw httpError.conflict("Danh mục không ở trạng thái Soạn thảo");
        }

        const items = await db.select().from(disposalProposalItems)
            .where(eq(disposalProposalItems.catalogId, catalogId));
        if (items.length === 0) {
            throw httpError.badRequest("Danh mục chưa có hồ sơ nào");
        }

        const missingReason = items.filter((item) => !item.reason.trim());
        if (missingReason.length > 0) {
            throw httpError.badRequest(
                `Còn ${missingReason.length} mục chưa nhập lý do đề xuất hủy`,
            );
        }

        const now = new Date();
        const [updated] = await db.update(disposalProposalCatalogs)
            .set({
                status: DisposalProposalCatalogStatus.SUBMITTED,
                updatedAt: now,
            })
            .where(eq(disposalProposalCatalogs.id, catalogId))
            .returning();

        return updated!;
    },

    async transferToProposal(
        profile: UserWithRoles,
        input: {
            catalogId?: string;
            name?: string;
            catalogDate?: string;
            items: Array<{
                dossierId: string;
                fileId?: string | null;
                source: DisposalProposalItemSourceType;
            }>;
        },
    ) {
        if (input.items.length === 0) {
            throw httpError.badRequest("Chưa chọn hồ sơ nào");
        }

        await assertCouncilReviewWorkflowEnabled();

        let catalogId = input.catalogId?.trim();
        if (!catalogId) {
            const created = await this.createCatalog(profile, {
                name: input.name?.trim() || `Danh mục đề xuất hủy ${new Date().toLocaleDateString("vi-VN")}`,
                catalogDate: input.catalogDate ?? new Date().toISOString().slice(0, 10),
            });
            catalogId = created.id;
        } else {
            const [existing] = await db.select().from(disposalProposalCatalogs)
                .where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
            if (!existing) throw httpError.notFound("Không tìm thấy danh mục");
            if (existing.status !== DisposalProposalCatalogStatus.DRAFT) {
                throw httpError.conflict("Chỉ được thêm vào danh mục ở trạng thái Soạn thảo");
            }
        }

        const insertedItems = [];
        for (const item of input.items) {
            try {
                const row = await this.upsertCatalogItem(catalogId, item);
                insertedItems.push(row);
            } catch (err) {
                if (err instanceof Error && err.message.includes("Hồ sơ đã có")) {
                    continue;
                }
                throw err;
            }
        }

        return { catalogId, items: insertedItems };
    },
};
