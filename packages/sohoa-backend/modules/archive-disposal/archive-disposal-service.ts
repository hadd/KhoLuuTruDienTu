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
import { AppError, httpError } from "@shared/common-lib";
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
    type DuplicateMatch,
} from "../../libs/duplicate-detection.ts";
import {
    classifyRetentionStatus,
    computeRetentionExpiresAt,
    isRetentionCandidateStatus,
    type RetentionExpiryStatus,
} from "../../libs/retention-expiry.ts";
import { resolveDossierEffectiveRetentionBatch } from "../../libs/retention-dossier.ts";
import type { ArchiveDataScope } from "../archive-permission/index.ts";
import { resolveWarehouseScope } from "../archive/archive-warehouse-scope.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { collectDescendantItemIds } from "../physical-warehouse/physical-warehouse-service.ts";
import { assertCouncilReviewWorkflowEnabled, getDisposalSettingsRow } from "./disposal-settings-utils.ts";
import {
    assertCatalogFondConsistency,
    resolveCatalogFondMeta,
} from "./disposal-catalog-fond.ts";

const DISPOSAL_CATALOG_ITEM_DUPLICATE_MESSAGE = "Hồ sơ đã có trong danh mục";

function isDisposalCatalogItemDuplicateError(err: unknown): boolean {
    return (
        err instanceof AppError &&
        err.status === 409 &&
        err.message === DISPOSAL_CATALOG_ITEM_DUPLICATE_MESSAGE
    );
}

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

/**
 * Load a minimal snapshot of ALL archived dossiers within the user's permission scope
 * (ignoring any user-applied filters) specifically for duplicate detection.
 * This ensures that a dossier filtered out of the display list can still be counted
 * as a duplicate peer for dossiers that ARE in the display list.
 */
async function loadAllScopedRowsForDuplicateDetection(
    scope: ArchiveDataScope,
    dossierCodeFieldKey: string,
): Promise<{ records: DuplicateCandidateRecord[]; fileIdsByDossier: Map<string, string[]> }> {
    // Load dossiers with scope-only constraints (no user filters)
    const where = await buildScopeWhere(scope, {});
    if (where === sql`false`) return { records: [], fileIdsByDossier: new Map() };

    const dossierRows = await db
        .select({
            id: dossiers.id,
            name: dossiers.name,
            fondId: dossiers.fondId,
        })
        .from(dossiers)
        .where(where);

    if (dossierRows.length === 0) return { records: [], fileIdsByDossier: new Map() };

    const allDossierIds = dossierRows.map((r) => r.id);

    // Load field values for dossier code + metadata similarity checks
    const submissionRows = await db
        .selectDistinctOn([archiveSubmissions.dossierId], {
            dossierId: archiveSubmissions.dossierId,
            fieldValues: archiveSubmissions.fieldValues,
        })
        .from(archiveSubmissions)
        .where(and(
            inArray(archiveSubmissions.dossierId, allDossierIds),
            eq(archiveSubmissions.status, ArchiveSubmissionStatus.APPROVED),
        ))
        .orderBy(archiveSubmissions.dossierId, desc(archiveSubmissions.reviewedAt));

    const submissionByDossier = new Map(
        submissionRows.map((r) => [r.dossierId, r.fieldValues as Record<string, unknown>]),
    );

    // Load file names for FILE_NAME_STRICT rule
    const allFileRows = await db
        .select({
            id: dossierFiles.id,
            dossierId: dossierFiles.dossierId,
            fileName: dossierFiles.fileName,
        })
        .from(dossierFiles)
        .where(inArray(dossierFiles.dossierId, allDossierIds));

    const fileIdsByDossier = new Map<string, string[]>();
    for (const f of allFileRows) {
        const list = fileIdsByDossier.get(f.dossierId) ?? [];
        list.push(f.id);
        fileIdsByDossier.set(f.dossierId, list);
    }

    const records: DuplicateCandidateRecord[] = [];
    for (const row of dossierRows) {
        const fieldValues = submissionByDossier.get(row.id) ?? {};
        const fullMetadataText = Object.values(fieldValues).filter((v) => typeof v === "string").join(" ");
        records.push({
            dossierId: row.id,
            fondId: row.fondId,
            dossierName: row.name,
            dossierCode: extractDossierCodeFromFieldValues(fieldValues, dossierCodeFieldKey),
            fullMetadataText,
        });
        for (const file of allFileRows.filter((f) => f.dossierId === row.id)) {
            records.push({
                dossierId: row.id,
                fondId: row.fondId,
                fileId: file.id,
                dossierName: row.name,
                fileName: file.fileName,
                fullMetadataText: null,
            });
        }
    }

    return { records, fileIdsByDossier };
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
            inArray(
                sql`${disposalProposalCatalogs.status}::text`,
                [...ACTIVE_DISPOSAL_CATALOG_STATUSES],
            ),
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

async function executeDirectDestroyCandidates(
    profile: UserWithRoles,
    candidateKeys: string[],
) {
    if (!candidateKeys || candidateKeys.length === 0) return;

    const dossierIds = new Set<string>();
    const fileIds = new Set<string>();

    for (const key of candidateKeys) {
        if (key.startsWith("dossier:")) {
            dossierIds.add(key.replace("dossier:", ""));
        } else if (key.startsWith("file:")) {
            fileIds.add(key.replace("file:", ""));
        }
    }

    const now = new Date();

    await db.transaction(async (tx) => {
        if (dossierIds.size > 0) {
            await tx.update(dossiers)
                .set({ 
                    archiveStorageState: ArchiveStorageState.DESTROYED,
                    updatedAt: now,
                })
                .where(inArray(dossiers.id, Array.from(dossierIds)));
        }

        if (fileIds.size > 0) {
            await tx.update(dossierFiles)
                .set({
                    deletedAt: now,
                    updatedAt: now,
                })
                .where(inArray(dossierFiles.id, Array.from(fileIds)));
        }
    });

    logActivity({
        userId: profile.id,
        module: "archive-disposal",
        eventType: "disposal.candidates.destroyed",
        summary: `Thực hiện hủy trực tiếp ${dossierIds.size} hồ sơ và ${fileIds.size} tài liệu`,
        entityType: "system",
        entityId: "archive-disposal",
        entityLabel: "Trực tiếp",
    });
}

export const ArchiveDisposalService = {
    executeDirectDestroyCandidates,
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

        // For duplicate detection, we must check against the FULL scope (all dossiers the user
        // has access to), not just the filtered display rows. This ensures a dossier filtered
        // out of the current view is still counted as a duplicate peer.
        // We skip the full-scope load when the user is only looking at expiry data (no duplicates needed).
        let duplicateMatches: Map<string, DuplicateMatch>;
        const needsDuplicateCheck = category === "duplicate" || category === "all";
        if (needsDuplicateCheck && enabledRules.size > 0) {
            const { records: allRecords } = await loadAllScopedRowsForDuplicateDetection(
                scope,
                dossierCodeFieldKey,
            );
            duplicateMatches = detectDuplicateMatches(allRecords, enabledRules, dossierCodeFieldKey);
        } else {
            // For expiry-only views, detect duplicates only within the loaded rows (fast path)
            const duplicateRecords: DuplicateCandidateRecord[] = [];
            for (const row of dossierRows) {
                const fullMetadataText = row.fieldValues
                    ? Object.values(row.fieldValues).filter((v) => typeof v === "string").join(" ")
                    : "";
                duplicateRecords.push({
                    dossierId: row.id,
                    fondId: row.fondId,
                    dossierName: row.name,
                    dossierCode: extractDossierCodeFromFieldValues(row.fieldValues, dossierCodeFieldKey),
                    fullMetadataText,
                });
                for (const file of fileRows.filter((f) => f.dossierId === row.id)) {
                    duplicateRecords.push({
                        dossierId: row.id,
                        fondId: row.fondId,
                        fileId: file.id,
                        dossierName: row.name,
                        fileName: file.fileName,
                        fullMetadataText: null,
                    });
                }
            }
            duplicateMatches = detectDuplicateMatches(duplicateRecords, enabledRules, dossierCodeFieldKey);
        }

        const candidates: CandidateItem[] = [];
        const groupMap = new Map<string, CandidateGroup>();

        // Build a reverse lookup: dossierId → file-level DuplicateMatch (for criteria info)
        const dossierFileDuplicateMap = new Map<string, DuplicateMatch>();
        for (const file of fileRows) {
            const fileMatch = duplicateMatches.get(`file:${file.id}`);
            if (fileMatch) {
                const existing = dossierFileDuplicateMap.get(file.dossierId);
                if (!existing || fileMatch.duplicateGroupId < existing.duplicateGroupId) {
                    dossierFileDuplicateMap.set(file.dossierId, fileMatch);
                }
            }
        }

        // ── Global dossier-level Union-Find ──────────────────────────────────
        // Connect all dossiers that share ANY common duplicate group
        // (file-level OR dossier-level) so they all get one canonical visual groupId.
        // This fixes the case where A,B,C all share BIA_CD.pdf but were getting
        // separate colors because their metadata-sim groups were different pairs.
        const ufDosParent = new Map<string, string>();
        const ufDosFind = (x: string): string => {
            if (!ufDosParent.has(x)) ufDosParent.set(x, x);
            const p = ufDosParent.get(x)!;
            if (p === x) return x;
            const root = ufDosFind(p);
            ufDosParent.set(x, root);
            return root;
        };
        const ufDosUnion = (x: string, y: string) => {
            const rx = ufDosFind(x), ry = ufDosFind(y);
            if (rx === ry) return;
            if (rx < ry) ufDosParent.set(ry, rx);
            else ufDosParent.set(rx, ry);
        };

        // 1. Union via shared file-level groups
        const fileGroupDossierMap = new Map<string, string[]>();
        for (const f of fileRows) {
            const m = duplicateMatches.get(`file:${f.id}`);
            if (m) {
                const arr = fileGroupDossierMap.get(m.duplicateGroupId) ?? [];
                arr.push(f.dossierId);
                fileGroupDossierMap.set(m.duplicateGroupId, arr);
            }
        }
        for (const ids of fileGroupDossierMap.values()) {
            for (let i = 1; i < ids.length; i++) ufDosUnion(ids[0], ids[i]);
        }

        // 2. Union via shared dossier-level groups (name, code, metadata-sim)
        const dossierGroupMap2 = new Map<string, string[]>();
        for (const id of dossierIds) {
            const m = duplicateMatches.get(`dossier:${id}`);
            if (m) {
                const arr = dossierGroupMap2.get(m.duplicateGroupId) ?? [];
                arr.push(id);
                dossierGroupMap2.set(m.duplicateGroupId, arr);
            }
        }
        for (const ids of dossierGroupMap2.values()) {
            for (let i = 1; i < ids.length; i++) ufDosUnion(ids[0], ids[i]);
        }

        // Precompute which dossiers have at least one file-level duplicate
        const fileMatchedDossierIds = new Set(
            fileRows.filter((f) => duplicateMatches.has(`file:${f.id}`)).map((f) => f.dossierId),
        );

        // Returns the canonical visual groupId for a dossier, or null if no duplicate found
        function getDossierVisualGroupId(id: string): string | null {
            if (!duplicateMatches.has(`dossier:${id}`) && !fileMatchedDossierIds.has(id)) return null;
            return `vg:${ufDosFind(id)}`;
        }
        // ─────────────────────────────────────────────────────────────────────

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
            // A dossier is a duplicate candidate if it has a dossier-level match (name/code)
            // OR if any of its files are file-level duplicates (e.g. BIA_CD.pdf in multiple dossiers)
            const rawDossierDuplicate = duplicateMatches.get(`dossier:${row.id}`) ??
                dossierFileDuplicateMap.get(row.id) ??
                null;
            // Override groupId with the canonical visual group so all connected dossiers share one color
            const visualGroupId = getDossierVisualGroupId(row.id);
            const dossierDuplicate = rawDossierDuplicate && visualGroupId
                ? { ...rawDossierDuplicate, duplicateGroupId: visualGroupId }
                : rawDossierDuplicate;
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

        const { catalogFondId, catalogFondName } = await resolveCatalogFondMeta(catalogId);

        return {
            catalog: {
                ...catalog,
                catalogDate: catalog.catalogDate.toISOString().slice(0, 10),
                createdAt: catalog.createdAt.toISOString(),
                updatedAt: catalog.updatedAt.toISOString(),
            },
            catalogFondId,
            catalogFondName,
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
        if (!updated) throw httpError.notFound("Không tìm thấy danh mục");
        return {
            ...updated,
            catalogDate: updated.catalogDate.toISOString().slice(0, 10),
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
        };
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
            throw httpError.conflict(DISPOSAL_CATALOG_ITEM_DUPLICATE_MESSAGE);
        }

        await assertCatalogFondConsistency(catalogId, [input.dossierId]);

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

        const dossierIds = [...new Set(input.items.map((item) => item.dossierId))];
        await assertCatalogFondConsistency(catalogId, dossierIds);

        const insertedItems = [];
        let skippedDuplicateCount = 0;
        for (const item of input.items) {
            try {
                const row = await this.upsertCatalogItem(catalogId, item);
                insertedItems.push(row);
            } catch (err) {
                if (isDisposalCatalogItemDuplicateError(err)) {
                    skippedDuplicateCount += 1;
                    continue;
                }
                throw err;
            }
        }

        if (insertedItems.length === 0 && skippedDuplicateCount > 0) {
            throw httpError.conflict(DISPOSAL_CATALOG_ITEM_DUPLICATE_MESSAGE);
        }

        return { catalogId, items: insertedItems, skippedDuplicateCount };
    },
};

export type DisposalCandidateWarehouseLockScope = {
    dossierLocked: boolean;
    lockedFileIds: Set<string>;
};

export async function loadDisposalScopeDuplicateMatches(
    scope: ArchiveDataScope,
): Promise<Map<string, DuplicateMatch>> {
    const dossierRows = await loadArchivedDossierRows(scope, {});
    if (dossierRows.length === 0) {
        return new Map();
    }

    const dossierIds = dossierRows.map((r) => r.id);
    const [fileRows, rules] = await Promise.all([
        db.select({
            id: dossierFiles.id,
            dossierId: dossierFiles.dossierId,
            fileName: dossierFiles.fileName,
            fileSizeKb: dossierFiles.fileSizeKb,
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

    return detectDuplicateMatches(
        duplicateRecords,
        enabledRules,
        dossierCodeFieldKey,
    );
}

function buildDisposalCandidateCategories(input: {
    retentionStatus: RetentionExpiryStatus;
    dossierDuplicate: boolean;
    fileDuplicate: boolean;
}): Array<"expiring_soon" | "expired" | "duplicate"> {
    const categories: Array<"expiring_soon" | "expired" | "duplicate"> = [];
    if (input.retentionStatus === "EXPIRING_SOON") {
        categories.push("expiring_soon");
    }
    if (input.retentionStatus === "EXPIRED") {
        categories.push("expired");
    }
    if (input.dossierDuplicate || input.fileDuplicate) {
        categories.push("duplicate");
    }
    return categories;
}

export async function resolveDisposalCandidateWarehouseLockScope(
    profile: UserWithRoles,
    dossierId: string,
): Promise<DisposalCandidateWarehouseLockScope | null> {
    const settings = await getDisposalSettingsRow();
    if (!settings.councilReviewEnabled) {
        return null;
    }

    const { scope } = await resolveWarehouseScope(profile);
    const dossierRows = await loadArchivedDossierRows(scope, {});
    const row = dossierRows.find((r) => r.id === dossierId);
    if (!row) {
        return null;
    }

    const [retentionByDossier, duplicateMatches, fileRows] = await Promise.all([
        resolveDossierEffectiveRetentionBatch([dossierId]),
        loadDisposalScopeDuplicateMatches(scope),
        db.select({
            id: dossierFiles.id,
        }).from(dossierFiles).where(eq(dossierFiles.dossierId, dossierId)),
    ]);

    const retention = retentionByDossier.get(dossierId) ?? null;
    const reviewedAt = row.reviewedAt;
    const expiresAt = retention
        ? computeRetentionExpiresAt(reviewedAt, retention)
        : null;
    const retentionStatus = classifyRetentionStatus(expiresAt, {
        isPermanent: retention?.isPermanent,
    });

    const dossierDuplicate = duplicateMatches.has(`dossier:${dossierId}`);
    const dossierCategories = buildDisposalCandidateCategories({
        retentionStatus,
        dossierDuplicate,
        fileDuplicate: false,
    });

    const lockedFileIds = new Set<string>();
    for (const file of fileRows) {
        const fileDuplicate = duplicateMatches.has(`file:${file.id}`);
        if (isRetentionCandidateStatus(retentionStatus)) {
            const fileCategories = buildDisposalCandidateCategories({
                retentionStatus,
                dossierDuplicate: false,
                fileDuplicate,
            });
            if (fileCategories.length > 0) {
                lockedFileIds.add(file.id);
            }
        } else if (fileDuplicate) {
            lockedFileIds.add(file.id);
        }
    }

    const dossierLocked = dossierCategories.length > 0;
    if (!dossierLocked && lockedFileIds.size === 0) {
        return null;
    }

    return { dossierLocked, lockedFileIds };
}
