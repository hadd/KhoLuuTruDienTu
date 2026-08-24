import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    DossierPhysicalPlacementStatus,
} from "../../db/schemas/dossier-physical-placement-constants.ts";
import { dossierPhysicalPlacements } from "../../db/schemas/dossier-physical-placement.ts";
import { physicalWarehouseItems } from "../../db/schemas/physical-warehouse-item.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function isStorageUnitItem(item: {
    parentId: string | null;
    isBottomLevel: boolean;
}): boolean {
    // isBottomLevel is the single source of truth for "ô chứa" (storage unit).
    // Do not re-derive this from `capacity` — capacity now also caps the number
    // of direct children for non-bottom-level nodes (location/warehouse/intermediate).
    return item.parentId != null && item.isBottomLevel;
}

export async function getUsedCapacityByItemIds(
    itemIds: Array<string>,
): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (itemIds.length === 0) return map;

    const rows = await db
        .select({
            physicalItemId: dossierPhysicalPlacements.physicalItemId,
            used: sql<number>`coalesce(sum(${dossierPhysicalPlacements.units}), 0)`.mapWith(
                Number,
            ),
        })
        .from(dossierPhysicalPlacements)
        .where(
            and(
                inArray(dossierPhysicalPlacements.physicalItemId, itemIds),
                eq(
                    dossierPhysicalPlacements.status,
                    DossierPhysicalPlacementStatus.ACTIVE,
                ),
            ),
        )
        .groupBy(dossierPhysicalPlacements.physicalItemId);

    for (const row of rows) {
        map.set(row.physicalItemId, row.used);
    }
    return map;
}

/**
 * Đếm số văn bản (files) hiện có của từng hồ sơ.
 * Cùng pattern với loadDocumentStatsByDossierIds bên archive-warehouse-service.
 */
export async function getDocumentCountByDossierIds(
    dossierIds: Array<string>,
): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (dossierIds.length === 0) return map;

    const rows = await db
        .select({
            dossierId: dossierFiles.dossierId,
            documentCount: sql<number>`count(*)::int`.mapWith(Number),
        })
        .from(dossierFiles)
        .where(inArray(dossierFiles.dossierId, dossierIds))
        .groupBy(dossierFiles.dossierId);

    for (const row of rows) {
        map.set(row.dossierId, row.documentCount);
    }
    return map;
}

export async function getActivePlacementForDossier(dossierId: string) {
    const [row] = await db
        .select()
        .from(dossierPhysicalPlacements)
        .where(
            and(
                eq(dossierPhysicalPlacements.dossierId, dossierId),
                eq(
                    dossierPhysicalPlacements.status,
                    DossierPhysicalPlacementStatus.ACTIVE,
                ),
            ),
        )
        .limit(1);
    return row ?? null;
}

export async function assertBottomLevelItem(itemId: string) {
    const [item] = await db
        .select()
        .from(physicalWarehouseItems)
        .where(eq(physicalWarehouseItems.id, itemId))
        .limit(1);
    if (!item) {
        throw httpError.badRequest("Vị trí kho vật lý không tồn tại");
    }
    if (!isStorageUnitItem(item)) {
        throw httpError.badRequest("Chỉ được chọn ô chứa (cấp thấp nhất)");
    }

    const [childRow] = await db
        .select({ value: sql<number>`count(*)`.mapWith(Number) })
        .from(physicalWarehouseItems)
        .where(eq(physicalWarehouseItems.parentId, itemId));
    if ((childRow?.value ?? 0) > 0) {
        throw httpError.badRequest("Ô chứa không được có mục con");
    }

    return { item };
}

export async function resolvePhysicalItemBreadcrumb(
    itemId: string,
): Promise<string | null> {
    const ancestorIds = await resolvePhysicalItemAncestorIds(itemId);
    if (ancestorIds.length === 0) return null;

    const rows = await db
        .select({
            id: physicalWarehouseItems.id,
            name: physicalWarehouseItems.name,
        })
        .from(physicalWarehouseItems)
        .where(inArray(physicalWarehouseItems.id, ancestorIds));

    const nameById = new Map(rows.map((row) => [row.id, row.name]));
    const names = ancestorIds
        .map((id) => nameById.get(id))
        .filter((name): name is string => Boolean(name));

    return names.length > 0 ? names.join(" > ") : null;
}

/** Path from location root to item (inclusive), ordered root → … → item. */
export async function resolvePhysicalItemAncestorIds(
    itemId: string,
): Promise<Array<string>> {
    const ids: Array<string> = [];
    let currentId: string | null = itemId;
    const guard = new Set<string>();

    while (currentId && !guard.has(currentId)) {
        guard.add(currentId);
        const [row]: Array<{ id: string; parentId: string | null }> = await db
            .select({
                id: physicalWarehouseItems.id,
                parentId: physicalWarehouseItems.parentId,
            })
            .from(physicalWarehouseItems)
            .where(eq(physicalWarehouseItems.id, currentId))
            .limit(1);
        if (!row) break;
        ids.unshift(row.id);
        currentId = row.parentId;
    }

    return ids;
}

export type PhysicalPlacementSearchEnrichment = {
    physicalItemId: string;
    locationRootId: string | null;
    breadcrumb: string;
    ancestorIds: Array<string>;
};

export async function loadPhysicalPlacementEnrichmentByDossierIds(
    dossierIds: Array<string>,
): Promise<Map<string, PhysicalPlacementSearchEnrichment>> {
    const result = new Map<string, PhysicalPlacementSearchEnrichment>();
    if (dossierIds.length === 0) return result;

    const placementRows = await db
        .select()
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

    if (placementRows.length === 0) return result;

    const ancestorCache = new Map<string, Array<string>>();

    async function getAncestorIds(itemId: string): Promise<Array<string>> {
        const cached = ancestorCache.get(itemId);
        if (cached) return cached;
        const ids = await resolvePhysicalItemAncestorIds(itemId);
        ancestorCache.set(itemId, ids);
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i]!;
            if (!ancestorCache.has(id)) {
                ancestorCache.set(id, ids.slice(0, i + 1));
            }
        }
        return ids;
    }

    const allItemIds = new Set<string>();
    const placementMeta = new Map<
        string,
        { physicalItemId: string; locationRootId: string | null }
    >();

    for (const placement of placementRows) {
        placementMeta.set(placement.dossierId, {
            physicalItemId: placement.physicalItemId,
            locationRootId: placement.locationRootId,
        });
        const ancestorIds = await getAncestorIds(placement.physicalItemId);
        for (const id of ancestorIds) allItemIds.add(id);
    }

    const nameRows = allItemIds.size > 0
        ? await db
            .select({
                id: physicalWarehouseItems.id,
                name: physicalWarehouseItems.name,
            })
            .from(physicalWarehouseItems)
            .where(inArray(physicalWarehouseItems.id, [...allItemIds]))
        : [];

    const nameById = new Map(nameRows.map((row) => [row.id, row.name]));

    for (const [dossierId, meta] of placementMeta) {
        const ancestorIds = ancestorCache.get(meta.physicalItemId) ??
            await getAncestorIds(meta.physicalItemId);
        const breadcrumb = ancestorIds
            .map((id) => nameById.get(id))
            .filter((name): name is string => Boolean(name))
            .join(" > ");

        result.set(dossierId, {
            physicalItemId: meta.physicalItemId,
            locationRootId: meta.locationRootId,
            breadcrumb,
            ancestorIds,
        });
    }

    return result;
}

export async function findLocationRootId(
    itemId: string,
): Promise<string | null> {
    let currentId: string | null = itemId;
    const guard = new Set<string>();
    let last: { id: string; parentId: string | null } | null = null;

    while (currentId && !guard.has(currentId)) {
        guard.add(currentId);
        const [row] = await db
            .select({
                id: physicalWarehouseItems.id,
                parentId: physicalWarehouseItems.parentId,
            })
            .from(physicalWarehouseItems)
            .where(eq(physicalWarehouseItems.id, currentId))
            .limit(1);
        if (!row) break;
        last = row;
        if (row.parentId == null) {
            return row.id;
        }
        currentId = row.parentId;
    }
    return last && last.parentId == null ? last.id : null;
}

export async function assertItemHasCapacity(
    itemId: string,
    units: number,
    excludeDossierId?: string,
) {
    const { item } = await assertBottomLevelItem(itemId);
    if (item.capacity == null) {
        throw httpError.badRequest("Ô chứa chưa cấu hình sức chứa");
    }

    const usedMap = await getUsedCapacityByItemIds([itemId]);
    let used = usedMap.get(itemId) ?? 0;

    if (excludeDossierId) {
        const existing = await getActivePlacementForDossier(excludeDossierId);
        if (
            existing &&
            existing.physicalItemId === itemId
        ) {
            used = Math.max(0, used - existing.units);
        }
    }

    if (used + units > item.capacity) {
        throw httpError.badRequest(
            `Hộp đã đầy (${used}/${item.capacity}). Vui lòng chọn vị trí khác.`,
        );
    }

    return { item, used, capacity: item.capacity };
}

export const PlacementService = {
    async getByDossier(dossierId: string) {
        const placement = await getActivePlacementForDossier(dossierId);
        if (!placement) {
            return { placement: null, breadcrumb: null };
        }
        const breadcrumb = await resolvePhysicalItemBreadcrumb(
            placement.physicalItemId,
        );
        return { placement, breadcrumb };
    },

    async listByPhysicalItem(physicalItemId: string) {
        await assertBottomLevelItem(physicalItemId);
        const rows = await db
            .select({
                placement: dossierPhysicalPlacements,
                dossierName: dossiers.name,
                folderPath: dossiers.folderPath,
                dossierStatus: dossiers.status,
                deletedAt: dossiers.deletedAt,
            })
            .from(dossierPhysicalPlacements)
            .innerJoin(
                dossiers,
                eq(dossiers.id, dossierPhysicalPlacements.dossierId),
            )
            .where(
                and(
                    eq(
                        dossierPhysicalPlacements.physicalItemId,
                        physicalItemId,
                    ),
                    eq(
                        dossierPhysicalPlacements.status,
                        DossierPhysicalPlacementStatus.ACTIVE,
                    ),
                ),
            )
            .orderBy(asc(dossiers.name));

        const dossierIds = rows.map((row) => row.placement.dossierId);
        const documentCountByDossierId = await getDocumentCountByDossierIds(
            dossierIds,
        );

        return {
            items: rows.map((row) => ({
                ...row.placement,
                dossierName: row.dossierName,
                folderPath: row.folderPath,
                dossierStatus: row.dossierStatus,
                deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
                documentCount:
                    documentCountByDossierId.get(row.placement.dossierId) ?? 0,
            })),
        };
    },

    async listUnplacedArchived(params?: { page?: number; limit?: number }) {
        const page = Math.max(1, params?.page ?? 1);
        const limit = Math.min(100, Math.max(1, params?.limit ?? 20));
        const offset = (page - 1) * limit;

        const whereClause = and(
            activeDossierWhere(),
            eq(dossiers.status, DossierStatus.ARCHIVED),
            isNull(dossierPhysicalPlacements.id),
        );

        const baseFrom = db
            .select({
                id: dossiers.id,
                name: dossiers.name,
                folderPath: dossiers.folderPath,
                status: dossiers.status,
                updatedAt: dossiers.updatedAt,
            })
            .from(dossiers)
            .leftJoin(
                dossierPhysicalPlacements,
                and(
                    eq(dossierPhysicalPlacements.dossierId, dossiers.id),
                    eq(
                        dossierPhysicalPlacements.status,
                        DossierPhysicalPlacementStatus.ACTIVE,
                    ),
                ),
            )
            .where(whereClause);

        const [countRow] = await db
            .select({ value: sql<number>`count(*)`.mapWith(Number) })
            .from(dossiers)
            .leftJoin(
                dossierPhysicalPlacements,
                and(
                    eq(dossierPhysicalPlacements.dossierId, dossiers.id),
                    eq(
                        dossierPhysicalPlacements.status,
                        DossierPhysicalPlacementStatus.ACTIVE,
                    ),
                ),
            )
            .where(whereClause);

        const items = await baseFrom
            .orderBy(asc(dossiers.name))
            .limit(limit)
            .offset(offset);

        const total = countRow?.value ?? 0;
        return {
            items,
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    },

    async place(input: {
        dossierId: string;
        physicalItemId: string;
        placedBy?: string | null;
        archiveSubmissionId?: string | null;
        units?: number;
        notes?: string | null;
        requireArchived?: boolean;
    }) {
        const units = input.units ?? 1;
        const requireArchived = input.requireArchived ?? true;

        const [dossier] = await db
            .select({
                id: dossiers.id,
                status: dossiers.status,
            })
            .from(dossiers)
            .where(and(eq(dossiers.id, input.dossierId), activeDossierWhere()))
            .limit(1);
        if (!dossier) {
            throw httpError.notFound("Hồ sơ không tồn tại");
        }
        if (requireArchived && dossier.status !== DossierStatus.ARCHIVED) {
            throw httpError.badRequest(
                "Chỉ hồ sơ đã lưu kho (ARCHIVED) mới được xếp vào kho vật lý",
            );
        }

        const existing = await getActivePlacementForDossier(input.dossierId);
        if (existing) {
            throw httpError.conflict(
                "Hồ sơ đã có vị trí kho vật lý. Hãy đổi vị trí thay vì gắn mới.",
            );
        }

        await assertItemHasCapacity(input.physicalItemId, units);
        const locationRootId = await findLocationRootId(input.physicalItemId);
        const now = new Date();

        const [placement] = await db
            .insert(dossierPhysicalPlacements)
            .values({
                dossierId: input.dossierId,
                physicalItemId: input.physicalItemId,
                locationRootId,
                archiveSubmissionId: input.archiveSubmissionId ?? null,
                units,
                status: DossierPhysicalPlacementStatus.ACTIVE,
                placedBy: input.placedBy ?? null,
                placedAt: now,
                notes: input.notes ?? null,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        const breadcrumb = await resolvePhysicalItemBreadcrumb(
            input.physicalItemId,
        );

        return { placement, breadcrumb };
    },

    async tryPlaceFromApproval(input: {
        dossierId: string;
        physicalItemId: string;
        placedBy: string;
        archiveSubmissionId: string;
    }): Promise<{ placed: boolean; reason?: string }> {
        try {
            await this.place({
                ...input,
                units: 1,
                requireArchived: true,
            });
            return { placed: true };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Không gắn được vị trí";
            return { placed: false, reason: message };
        }
    },

    async move(input: {
        dossierId: string;
        newPhysicalItemId: string;
        placedBy?: string | null;
        notes?: string | null;
    }) {
        const existing = await getActivePlacementForDossier(input.dossierId);
        if (!existing) {
            throw httpError.badRequest("Hồ sơ chưa có vị trí kho vật lý");
        }

        await assertItemHasCapacity(
            input.newPhysicalItemId,
            existing.units,
            input.dossierId,
        );
        const locationRootId = await findLocationRootId(input.newPhysicalItemId);
        const now = new Date();
        const fromBreadcrumb = await resolvePhysicalItemBreadcrumb(existing.physicalItemId);

        const result = await db.transaction(async (tx: DbTx) => {
            await tx
                .update(dossierPhysicalPlacements)
                .set({
                    status: DossierPhysicalPlacementStatus.MOVED,
                    updatedAt: now,
                })
                .where(eq(dossierPhysicalPlacements.id, existing.id));

            const [placement] = await tx
                .insert(dossierPhysicalPlacements)
                .values({
                    dossierId: input.dossierId,
                    physicalItemId: input.newPhysicalItemId,
                    locationRootId,
                    archiveSubmissionId: existing.archiveSubmissionId,
                    units: existing.units,
                    status: DossierPhysicalPlacementStatus.ACTIVE,
                    placedBy: input.placedBy ?? null,
                    placedAt: now,
                    notes: input.notes ?? null,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning();

            return {
                placement,
                fromBreadcrumb,
                breadcrumb: await resolvePhysicalItemBreadcrumb(
                    input.newPhysicalItemId,
                ),
            };
        });

        return result;
    },

    async remove(input: {
        dossierId: string;
        removedBy?: string | null;
        notes?: string | null;
    }) {
        const existing = await getActivePlacementForDossier(input.dossierId);
        if (!existing) {
            throw httpError.badRequest("Hồ sơ chưa có vị trí kho vật lý");
        }
        const now = new Date();
        const [placement] = await db
            .update(dossierPhysicalPlacements)
            .set({
                status: DossierPhysicalPlacementStatus.REMOVED,
                notes: input.notes ?? existing.notes,
                updatedAt: now,
            })
            .where(eq(dossierPhysicalPlacements.id, existing.id))
            .returning();

        const fromBreadcrumb = await resolvePhysicalItemBreadcrumb(existing.physicalItemId);

        return { placement, fromBreadcrumb };
    },

    async countActiveOnItem(physicalItemId: string) {
        const map = await getUsedCapacityByItemIds([physicalItemId]);
        return map.get(physicalItemId) ?? 0;
    },
};