import { asc, count, eq, inArray, isNull } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { Buffer } from "node:buffer";
import { db } from "../../db/db-conn.ts";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import { physicalWarehouseItems } from "../../db/schemas/physical-warehouse-item.ts";
import { buildLinkGet } from "../data-entry/data-entry-s3-utils.ts";
import {
    assertPhysicalWarehouseImageFile,
    buildPhysicalWarehouseImageKey,
    isPhysicalWarehouseImageKey,
} from "./physical-warehouse-storage.ts";
import type {
    CreateItemInput,
    UpdateItemInput,
} from "./types.ts";
import {
    getUsedCapacityByItemIds,
    PlacementService,
} from "./physical-placement-service.ts";

type ItemRow = typeof physicalWarehouseItems.$inferSelect;
type ItemWithDisplay = ItemRow & {
    imageDisplayUrl: string | null;
};

function resolveS3Bucket(): string {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    return bucket;
}

async function resolveImageDisplayUrl(
    imageUrl: string | null | undefined,
): Promise<string | null> {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        return imageUrl;
    }
    if (!isPhysicalWarehouseImageKey(imageUrl)) {
        return imageUrl;
    }
    try {
        return await buildLinkGet(imageUrl, { expirySeconds: 86_400 });
    } catch {
        return null;
    }
}

async function withDisplayUrl(item: ItemRow): Promise<ItemWithDisplay> {
    return {
        ...item,
        imageDisplayUrl: await resolveImageDisplayUrl(item.imageUrl),
    };
}

async function withDisplayUrls(items: Array<ItemRow>): Promise<Array<ItemWithDisplay>> {
    return await Promise.all(items.map((item) => withDisplayUrl(item)));
}

function isLocationItem(item: { parentId: string | null }): boolean {
    return item.parentId == null;
}

function isStorageUnitItem(item: {
    parentId: string | null;
    isBottomLevel: boolean;
}): boolean {
    return item.parentId != null && item.isBottomLevel;
}

function isIntermediateItem(item: {
    parentId: string | null;
    isBottomLevel: boolean;
}): boolean {
    return item.parentId != null && !item.isBottomLevel;
}

function normalizeOptionalString(value: string | null | undefined) {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/** Sức chứa của dãy/kệ/tầng/hộp: bắt buộc, số nguyên tự nhiên > 0. */
function assertRequiredPositiveCapacity(capacity: number | null | undefined) {
    if (
        capacity == null ||
        !Number.isInteger(capacity) ||
        capacity < 1
    ) {
        throw httpError.badRequest(
            "Sức chứa phải là số tự nhiên lớn hơn 0",
        );
    }
}

type ItemTreeNode = ItemWithDisplay & {
    children: ItemTreeNode[];
    childCount: number;
    usedCapacity?: number;
    isBottomLevel?: boolean;
};

async function getItemOrThrow(id: string) {
    const [item] = await db
        .select()
        .from(physicalWarehouseItems)
        .where(eq(physicalWarehouseItems.id, id))
        .limit(1);
    if (!item) {
        throw httpError.notFound("Không tìm thấy mục kho");
    }
    return item;
}

/**
 * Chuẩn hóa tên để so trùng: bỏ hết khoảng trắng + lowercase.
 * "kệ 1" và "kệ     1" được coi là trùng.
 */
function normalizeSiblingName(name: string): string {
    return name.replace(/\s+/g, "").toLowerCase();
}

/**
 * Đảm bảo không có 2 mục trùng tên trong cùng một cha.
 * So sánh sau khi bỏ hết khoảng trắng + lowercase (không phân biệt hoa thường).
 */
async function assertUniqueSiblingName(
    parentId: string | null,
    name: string,
    excludeId?: string,
  ) {
    const normalized = normalizeSiblingName(name);
    if (!normalized) return;
    const siblings = await db
      .select({
        id: physicalWarehouseItems.id,
        name: physicalWarehouseItems.name,
      })
      .from(physicalWarehouseItems)
      .where(
        parentId == null
          ? isNull(physicalWarehouseItems.parentId)
          : eq(physicalWarehouseItems.parentId, parentId),
      );
    const duplicated = siblings.some(
      (row) =>
        row.id !== excludeId &&
        normalizeSiblingName(row.name) === normalized,
    );
    if (duplicated) {
      throw httpError.badRequest(
        "Tên đã tồn tại. Vui lòng nhập tên khác.",
      );
    }
  }

async function getItemOrNull(id: string) {
    const [item] = await db
        .select()
        .from(physicalWarehouseItems)
        .where(eq(physicalWarehouseItems.id, id))
        .limit(1);
    return item ?? null;
}

/**
 * Chiều sâu tuyệt đối: địa điểm (gốc) = 0, kho = 1, Dãy = 2, Kệ = 3, Tầng = 4.
 */
async function getDepthFromLocation(id: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = id;
    const guard = new Set<string>();
    while (currentId && !guard.has(currentId)) {
        guard.add(currentId);
        const row = await getItemOrNull(currentId);
        if (!row) break;
        if (row.parentId == null) return depth; // chạm gốc địa điểm
        depth += 1;
        currentId = row.parentId;
    }
    return depth;
}

export async function collectDescendantItemIds(rootId: string): Promise<string[]> {
    const all = await db.select({
        id: physicalWarehouseItems.id,
        parentId: physicalWarehouseItems.parentId,
    }).from(physicalWarehouseItems);
    const childrenByParent = new Map<string | null, string[]>();
    for (const row of all) {
        const key = row.parentId;
        const list = childrenByParent.get(key) ?? [];
        list.push(row.id);
        childrenByParent.set(key, list);
    }
    const result: string[] = [];
    const stack = [rootId];
    while (stack.length > 0) {
        const current = stack.pop()!;
        result.push(current);
        const children = childrenByParent.get(current) ?? [];
        for (const childId of children) {
            stack.push(childId);
        }
    }
    return result;
}

function buildTree(
    items: Array<ItemWithDisplay & { usedCapacity?: number }>,
    rootId: string,
): ItemTreeNode | null {
    const byParent = new Map<
        string | null,
        Array<ItemWithDisplay & { usedCapacity?: number }>
    >();
    for (const item of items) {
        const key = item.parentId;
        const list = byParent.get(key) ?? [];
        list.push(item);
        byParent.set(key, list);
    }
    function toNode(
        item: ItemWithDisplay & { usedCapacity?: number },
    ): ItemTreeNode {
        const children = (byParent.get(item.id) ?? [])
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(toNode);
        return {
            ...item,
            children,
            childCount: children.length,
            usedCapacity: item.usedCapacity ?? 0,
            isBottomLevel: isStorageUnitItem(item),
        };
    }
    const root = items.find((i) => i.id === rootId);
    if (!root) return null;
    return toNode(root);
}

async function attachChildCounts<T extends { id: string }>(
    items: Array<T>,
): Promise<Array<T & { childCount: number }>> {
    if (items.length === 0) return [];
    const ids = items.map((item) => item.id);
    const rows = await db
        .select({
            parentId: physicalWarehouseItems.parentId,
            value: count(),
        })
        .from(physicalWarehouseItems)
        .where(inArray(physicalWarehouseItems.parentId, ids))
        .groupBy(physicalWarehouseItems.parentId);
    const countByParent = new Map<string, number>();
    for (const row of rows) {
        if (row.parentId) {
            countByParent.set(row.parentId, Number(row.value));
        }
    }
    return items.map((item) => ({
        ...item,
        childCount: countByParent.get(item.id) ?? 0,
    }));
}

async function assertNotDescendant(itemId: string, potentialAncestorId: string) {
    if (itemId === potentialAncestorId) {
        throw httpError.badRequest("Không thể di chuyển mục vào chính nó");
    }
    const descendants = await collectDescendantItemIds(itemId);
    if (descendants.includes(potentialAncestorId)) {
        throw httpError.badRequest("Không thể di chuyển mục vào mục con của nó");
    }
}

export const ItemService = {
    async list(params: {
        parentId?: string | null;
        availableOnly?: boolean;
    }) {
        let items: Array<ItemRow>;
        if (params.parentId === undefined || params.parentId === null) {
            items = await db
                .select()
                .from(physicalWarehouseItems)
                .where(isNull(physicalWarehouseItems.parentId))
                .orderBy(asc(physicalWarehouseItems.name));
        } else {
            items = await db
                .select()
                .from(physicalWarehouseItems)
                .where(eq(physicalWarehouseItems.parentId, params.parentId))
                .orderBy(asc(physicalWarehouseItems.name));
        }
        const withUrls = await withDisplayUrls(items);
        const withCounts = await attachChildCounts(withUrls);
        const usedMap = await getUsedCapacityByItemIds(
            withCounts.map((item) => item.id),
        );
        let result = withCounts.map((item) => {
            const usedCapacity = usedMap.get(item.id) ?? 0;
            const isBottom = isStorageUnitItem(item);
            return {
                ...item,
                usedCapacity,
                isBottomLevel: isBottom,
                remainingCapacity:
                    isBottom && item.capacity != null
                        ? Math.max(0, item.capacity - usedCapacity)
                        : null,
            };
        });
        if (params.availableOnly) {
            result = result.filter((item) => {
                if (!item.isBottomLevel) return true;
                if (item.capacity == null) return false;
                return item.usedCapacity < item.capacity;
            });
        }
        return { items: result };
    },

    /** List storage units (fixed bottom level) with breadcrumb for pickers. */
    async listBottomBoxes(params?: { availableOnly?: boolean }) {
        const allItems = await db
            .select({
                id: physicalWarehouseItems.id,
                name: physicalWarehouseItems.name,
                parentId: physicalWarehouseItems.parentId,
                capacity: physicalWarehouseItems.capacity,
                isBottomLevel: physicalWarehouseItems.isBottomLevel,
            })
            .from(physicalWarehouseItems);
        const byId = new Map(allItems.map((item) => [item.id, item]));
        const bottomItems = allItems.filter((item) => isStorageUnitItem(item));
        const usedMap = await getUsedCapacityByItemIds(
            bottomItems.map((item) => item.id),
        );
        function breadcrumbFor(itemId: string): string {
            const names: Array<string> = [];
            let currentId: string | null = itemId;
            const guard = new Set<string>();
            while (currentId && !guard.has(currentId)) {
                guard.add(currentId);
                const row = byId.get(currentId);
                if (!row) break;
                names.unshift(row.name);
                currentId = row.parentId;
            }
            return names.join(" > ");
        }
        let result = bottomItems.map((item) => {
            const usedCapacity = usedMap.get(item.id) ?? 0;
            return {
                id: item.id,
                name: item.name,
                capacity: item.capacity,
                usedCapacity,
                remainingCapacity:
                    item.capacity != null
                        ? Math.max(0, item.capacity - usedCapacity)
                        : null,
                breadcrumb: breadcrumbFor(item.id),
            };
        });
        if (params?.availableOnly) {
            result = result.filter((item) => {
                if (item.capacity == null) return false;
                return item.usedCapacity < item.capacity;
            });
        }
        result.sort((a, b) => a.breadcrumb.localeCompare(b.breadcrumb, "vi"));
        return { items: result };
    },

    async get(id: string) {
        const record = await getItemOrThrow(id);
        return { record: await withDisplayUrl(record) };
    },

    async tree(rootId: string) {
        await getItemOrThrow(rootId);
        const descendantIds = await collectDescendantItemIds(rootId);
        const items = await db
            .select()
            .from(physicalWarehouseItems)
            .where(inArray(physicalWarehouseItems.id, descendantIds));
        const withUrls = await withDisplayUrls(items);
        const usedMap = await getUsedCapacityByItemIds(
            withUrls.map((item) => item.id),
        );
        const withUsed = withUrls.map((item) => ({
            ...item,
            usedCapacity: usedMap.get(item.id) ?? 0,
        }));
        const tree = buildTree(withUsed, rootId);
        return { tree };
    },

    async uploadImage(file: File) {
        const s3 = await getS3Client();
        if (!s3) {
            throw httpError.serviceUnavailable("S3 is not configured");
        }
        const { ext, contentType } = assertPhysicalWarehouseImageFile(file);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const assetId = crypto.randomUUID();
        const storageKey = buildPhysicalWarehouseImageKey(assetId, ext);
        const bucket = resolveS3Bucket();
        await s3.getMinIOClient().putObject(
            bucket,
            storageKey,
            Buffer.from(bytes),
            bytes.byteLength,
            { "Content-Type": contentType },
        );
        const imageDisplayUrl = await buildLinkGet(storageKey, {
            expirySeconds: 86_400,
        });
        return {
            storageKey,
            imageUrl: storageKey,
            imageDisplayUrl,
        };
    },

    async stats(rootId: string) {
        await getItemOrThrow(rootId);
        const descendantIds = await collectDescendantItemIds(rootId);
        const items = await db
            .select()
            .from(physicalWarehouseItems)
            .where(inArray(physicalWarehouseItems.id, descendantIds));
        let locationCount = 0;
        let intermediateCount = 0;
        let bottomLevelCount = 0;
        let totalCapacity = 0;
        let overloadedCount = 0;
        for (const item of items) {
            if (isLocationItem(item)) {
                locationCount += 1;
                continue;
            }
            if (isStorageUnitItem(item)) {
                bottomLevelCount += 1;
                if (item.capacity != null) {
                    totalCapacity += item.capacity;
                }
            } else if (isIntermediateItem(item)) {
                intermediateCount += 1;
            }
        }
        const bottomItemIds = items
            .filter((item) => isStorageUnitItem(item))
            .map((item) => item.id);
        const usedMap = await getUsedCapacityByItemIds(bottomItemIds);
        let usedCapacity = 0;
        for (const itemId of bottomItemIds) {
            const used = usedMap.get(itemId) ?? 0;
            usedCapacity += used;
            const item = items.find((row) => row.id === itemId);
            if (item?.capacity != null && used > item.capacity) {
                overloadedCount += 1;
            }
        }
        const fillRate =
            totalCapacity > 0
                ? Math.min(
                    100,
                    Math.round((usedCapacity / totalCapacity) * 100),
                )
                : 0;
        return {
            stats: {
                locationCount,
                levelStats: [
                    {
                        levelId: "intermediate",
                        levelName: "Trung gian",
                        levelOrder: 1,
                        count: intermediateCount,
                    },
                    {
                        levelId: "storageUnit",
                        levelName: "Hộp/cặp",
                        levelOrder: 2,
                        count: bottomLevelCount,
                    },
                ],
                bottomLevelCount,
                totalCapacity,
                usedCapacity,
                fillRate,
                overloadedCount,
            },
        };
    },

    async create(input: CreateItemInput) {
        const parentId = input.parentId ?? null;
        const isLocation = parentId == null;
        // Nguồn sự thật duy nhất: flag isBottomLevel từ client — KHÔNG suy luận từ capacity.
        const wantsStorageUnit = input.isBottomLevel === true;

        if (isLocation) {
            await assertUniqueSiblingName(null, input.name);
            if (input.address) {
                throw httpError.badRequest("Địa điểm không có trường địa chỉ");
            }
            if (input.mapsUrl) {
                throw httpError.badRequest("Địa điểm không có trường liên kết Google Maps");
            }
            if (input.capacity != null) {
                throw httpError.badRequest("Địa điểm không có trường sức chứa");
            }
            const [record] = await db
                .insert(physicalWarehouseItems)
                .values({
                    parentId: null,
                    name: input.name.trim(),
                    imageUrl: normalizeOptionalString(input.imageUrl),
                    address: null,
                    mapsUrl: null,
                    capacity: null,
                    isBottomLevel: false,
                })
                .returning();
            return { record: await withDisplayUrl(record), status: "created" as const };
        }

        const parent = await getItemOrThrow(parentId);
        if (isStorageUnitItem(parent)) {
            throw httpError.badRequest(
                "Không thể thêm mục con vào ô chứa (cấp thấp nhất)",
            );
        }
        await assertUniqueSiblingName(parentId, input.name);

        // Ép cấu trúc cố định: Địa điểm → Kho → Dãy → Kệ → Tầng → Hộp(ô chứa).
        // depth: địa điểm = 0, kho = 1, Dãy = 2, Kệ = 3, Tầng = 4, Hộp = 5.
        const parentDepth = await getDepthFromLocation(parentId);
        if (parentDepth === 0) {
            // Dưới địa điểm chỉ tạo Kho (cấp trung gian)
            if (wantsStorageUnit) {
                throw httpError.badRequest(
                    "Không thể tạo ô chứa trực tiếp dưới địa điểm",
                );
            }
            if (input.capacity != null) {
                throw httpError.badRequest("Không thể đặt sức chứa ở cấp kho");
            }
        } else if (parentDepth >= 1 && parentDepth <= 3) {
            // Dưới Kho tạo Dãy, dưới Dãy tạo Kệ, dưới Kệ tạo Tầng (cấp trung gian)
            if (wantsStorageUnit) {
                throw httpError.badRequest(
                    "Ô chứa (Hộp) chỉ được tạo dưới cấp Tầng",
                );
            }
            assertRequiredPositiveCapacity(input.capacity);
        } else if (parentDepth === 4) {
            // Dưới Tầng chỉ tạo ô chứa (Hộp)
            if (!wantsStorageUnit) {
                throw httpError.badRequest(
                    "Dưới cấp Tầng chỉ được tạo ô chứa (Hộp)",
                );
            }
            assertRequiredPositiveCapacity(input.capacity);
        } else {
            throw httpError.badRequest(
                "Vượt quá cấu trúc tối đa: Kho → Dãy → Kệ → Tầng → Hộp",
            );
        }

        // Kiểm tra sức chứa (số mục con tối đa) của node cha trước khi thêm con mới.
        if (parent.capacity != null) {
            const currentChildCount = await ItemService.countChildren(parentId);
            if (currentChildCount >= parent.capacity) {
                throw httpError.badRequest(
                    `Cấp cha "${parent.name}" đã đạt số lượng mục con tối đa (${parent.capacity}). Không thể tạo thêm.`,
                );
            }
        }
        const [record] = await db
            .insert(physicalWarehouseItems)
            .values({
                parentId,
                name: input.name.trim(),
                imageUrl: normalizeOptionalString(input.imageUrl),
                address: normalizeOptionalString(input.address),
                mapsUrl: normalizeOptionalString(input.mapsUrl),
                // isBottomLevel = true  → capacity là sức chứa hồ sơ của ô.
                // isBottomLevel = false → capacity là số mục con tối đa.
                isBottomLevel: wantsStorageUnit,
                capacity: input.capacity ?? null,
            })
            .returning();
        return { record: await withDisplayUrl(record), status: "created" as const };
    },

    async update(id: string, input: UpdateItemInput) {
        const existing = await getItemOrThrow(id);
        if (input.name !== undefined) {
            await assertUniqueSiblingName(existing.parentId, input.name, id);
        }
        const childCount = await ItemService.countChildren(id);
        const usedMap = await getUsedCapacityByItemIds([id]);
        const used = usedMap.get(id) ?? 0;

        if (isLocationItem(existing)) {
            if (input.address !== undefined && input.address != null) {
                throw httpError.badRequest("Địa điểm không có trường địa chỉ");
            }
            if (input.mapsUrl !== undefined && input.mapsUrl != null) {
                throw httpError.badRequest("Địa điểm không có trường liên kết Google Maps");
            }
            if (input.capacity !== undefined && input.capacity != null) {
                throw httpError.badRequest("Địa điểm không có trường sức chứa");
            }
            const [record] = await db
                .update(physicalWarehouseItems)
                .set({
                    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
                    ...(input.imageUrl !== undefined
                        ? { imageUrl: normalizeOptionalString(input.imageUrl) }
                        : {}),
                    updatedAt: new Date(),
                })
                .where(eq(physicalWarehouseItems.id, id))
                .returning();
            return { record: await withDisplayUrl(record), status: "updated" as const };
        }

        let nextCapacity = existing.capacity;
        if (input.capacity !== undefined) {
            // Cấp kho (cha là gốc địa điểm): không cho sửa sức chứa.
            const parent = existing.parentId
                ? await getItemOrNull(existing.parentId)
                : null;
            const isWarehouseLevel = parent != null && parent.parentId == null;
            if (isWarehouseLevel) {
                if (input.capacity !== (existing.capacity ?? null)) {
                    throw httpError.badRequest(
                        "Không thể đặt sức chứa ở cấp kho",
                    );
                }
            } else if (input.capacity == null) {
                throw httpError.badRequest(
                    "Sức chứa phải là số tự nhiên lớn hơn 0",
                );
            } else {
                assertRequiredPositiveCapacity(input.capacity);
                if (isStorageUnitItem(existing)) {
                    // Ô chứa: sức chứa >= số hồ sơ đã đặt.
                    if (input.capacity < used) {
                        throw httpError.badRequest(
                            `Sức chứa phải lớn hơn hoặc bằng số hồ sơ hiện có trong hộp (${used}).`,
                        );
                    }
                } else if (input.capacity < childCount) {
                    // Cấp trung gian: sức chứa = số mục con tối đa,
                    // cho phép sửa kể cả khi đang có mục con, chỉ cần >= số con hiện tại.
                    throw httpError.badRequest(
                        `Sức chứa không được nhỏ hơn số mục con hiện tại (${childCount}).`,
                    );
                }
                nextCapacity = input.capacity;
            }
        } else if (isStorageUnitItem(existing) && childCount > 0) {
            // Should never happen if rules enforced; keep safe
            throw httpError.badRequest(
                "Ô chứa không được có mục con",
            );
        }

        const [record] = await db
            .update(physicalWarehouseItems)
            .set({
                ...(input.name !== undefined ? { name: input.name.trim() } : {}),
                ...(input.imageUrl !== undefined
                    ? { imageUrl: normalizeOptionalString(input.imageUrl) }
                    : {}),
                ...(input.address !== undefined
                    ? { address: normalizeOptionalString(input.address) }
                    : {}),
                ...(input.mapsUrl !== undefined
                    ? { mapsUrl: normalizeOptionalString(input.mapsUrl) }
                    : {}),
                ...(input.capacity !== undefined ? { capacity: nextCapacity } : {}),
                updatedAt: new Date(),
            })
            .where(eq(physicalWarehouseItems.id, id))
            .returning();
        return { record: await withDisplayUrl(record), status: "updated" as const };
    },

    async reparent(id: string, newParentId: string) {
        const existing = await getItemOrThrow(id);
        await assertNotDescendant(id, newParentId);
        await assertUniqueSiblingName(newParentId, existing.name);
        if (!isStorageUnitItem(existing)) {
            throw httpError.badRequest(
                "Chỉ có thể di chuyển ô chứa (cấp thấp nhất) trong sơ đồ kho",
            );
        }
        const newParent = await getItemOrThrow(newParentId);
        if (newParent.id === existing.parentId) {
            return {
                record: await withDisplayUrl(existing),
                fromParentId: existing.parentId,
                status: "updated" as const,
            };
        }
        if (isStorageUnitItem(newParent)) {
            throw httpError.badRequest("Không thể đặt ô chứa vào ô chứa khác");
        }
        // Ô chứa chỉ nằm dưới Tầng (depth 4); chặn ném vào các cấp khác.
        const newParentDepth = await getDepthFromLocation(newParentId);
        if (newParentDepth !== 4) {
            throw httpError.badRequest(
                "Ô chứa chỉ được đặt dưới cấp Tầng",
            );
        }
        if (newParent.capacity != null) {
            const currentChildCount = await ItemService.countChildren(newParentId);
            if (currentChildCount >= newParent.capacity) {
                throw httpError.badRequest(
                    `Cấp cha "${newParent.name}" đã đạt số lượng mục con tối đa (${newParent.capacity}). Không thể chuyển ô chứa vào đây.`,
                );
            }
        }
        await assertNotDescendant(id, newParentId);
        const [record] = await db
            .update(physicalWarehouseItems)
            .set({
                parentId: newParentId,
                updatedAt: new Date(),
            })
            .where(eq(physicalWarehouseItems.id, id))
            .returning();
        return {
            record: await withDisplayUrl(record),
            fromParentId: existing.parentId,
            status: "updated" as const,
        };
    },

    async delete(id: string) {
        const existing = await getItemOrThrow(id);
        const childCount = await ItemService.countChildren(id);
        if (childCount > 0) {
            throw httpError.badRequest(
                "Không thể xóa vì còn mục con. Hãy xóa các mục con trước.",
            );
        }
        const placedCount = await PlacementService.countActiveOnItem(id);
        if (placedCount > 0) {
            throw httpError.badRequest(
                "Không thể xóa vì còn hồ sơ gắn trong vị trí này.",
            );
        }
        await db
            .delete(physicalWarehouseItems)
            .where(eq(physicalWarehouseItems.id, id));
        return { record: await withDisplayUrl(existing), status: "deleted" as const };
    },

    async countChildren(parentId: string) {
        const [row] = await db
            .select({ value: count() })
            .from(physicalWarehouseItems)
            .where(eq(physicalWarehouseItems.parentId, parentId));
        return row?.value ?? 0;
    },
};