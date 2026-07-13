import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { physicalWarehouseItems } from "../../db/schemas/physical-warehouse-item.ts";
import { physicalWarehouseLevels } from "../../db/schemas/physical-warehouse-level.ts";
import type {
    CreateItemInput,
    ReplaceLevelsInput,
    UpdateItemInput,
} from "./types.ts";

async function listLevelsOrdered() {
    return db
        .select()
        .from(physicalWarehouseLevels)
        .orderBy(asc(physicalWarehouseLevels.levelOrder));
}

function assertUniqueOrders(levels: ReplaceLevelsInput["levels"]) {
    const orders = levels.map((l) => l.levelOrder);
    if (new Set(orders).size !== orders.length) {
        throw httpError.badRequest("Thứ tự cấp không được trùng nhau");
    }
    const expected = Array.from({ length: levels.length }, (_, i) => i + 1);
    const sorted = [...orders].sort((a, b) => a - b);
    if (sorted.some((v, i) => v !== expected[i])) {
        throw httpError.badRequest("Thứ tự cấp phải liên tục bắt đầu từ 1");
    }
}

export const LevelService = {
    async list() {
        const levels = await listLevelsOrdered();
        return { levels };
    },

    async replaceAll(input: ReplaceLevelsInput) {
        assertUniqueOrders(input.levels);

        const currentLevels = await listLevelsOrdered();
        const [itemWithLevel] = await db
            .select({ id: physicalWarehouseItems.id })
            .from(physicalWarehouseItems)
            .where(sql`${physicalWarehouseItems.levelId} IS NOT NULL`)
            .limit(1);

        // When warehouse items already reference levels, only allow rename (same count/order).
        if (itemWithLevel) {
            if (currentLevels.length !== input.levels.length) {
                throw httpError.badRequest(
                    "Không thể thay đổi số cấp khi đã có dữ liệu kho. Hãy xóa các mục kho trước.",
                );
            }

            const updated = await db.transaction(async (tx) => {
                const results = [];
                for (const level of input.levels) {
                    const existing = currentLevels.find(
                        (c) => c.levelOrder === level.levelOrder,
                    );
                    if (!existing) {
                        throw httpError.badRequest("Thứ tự cấp không khớp cấu hình hiện tại");
                    }
                    const [row] = await tx
                        .update(physicalWarehouseLevels)
                        .set({
                            levelName: level.levelName.trim(),
                            updatedAt: new Date(),
                        })
                        .where(eq(physicalWarehouseLevels.id, existing.id))
                        .returning();
                    results.push(row);
                }
                return results;
            });

            return {
                levels: updated.sort((a, b) => a.levelOrder - b.levelOrder),
            };
        }

        return await db.transaction(async (tx) => {
            await tx.delete(physicalWarehouseLevels);
            const inserted = await tx
                .insert(physicalWarehouseLevels)
                .values(
                    input.levels.map((level) => ({
                        levelName: level.levelName.trim(),
                        levelOrder: level.levelOrder,
                    })),
                )
                .returning();

            return {
                levels: inserted.sort((a, b) => a.levelOrder - b.levelOrder),
            };
        });
    },
};

type ItemTreeNode = typeof physicalWarehouseItems.$inferSelect & {
    children: ItemTreeNode[];
    childCount: number;
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

async function collectDescendantIds(rootId: string): Promise<string[]> {
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
    items: Array<typeof physicalWarehouseItems.$inferSelect>,
    rootId: string,
): ItemTreeNode | null {
    const byParent = new Map<string | null, typeof items>();
    for (const item of items) {
        const key = item.parentId;
        const list = byParent.get(key) ?? [];
        list.push(item);
        byParent.set(key, list);
    }

    function toNode(item: typeof items[number]): ItemTreeNode {
        const children = (byParent.get(item.id) ?? [])
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(toNode);
        return {
            ...item,
            children,
            childCount: children.length,
        };
    }

    const root = items.find((i) => i.id === rootId);
    if (!root) return null;
    return toNode(root);
}

async function resolveLevelRules(levelId: string | null | undefined) {
    const levels = await listLevelsOrdered();
    if (levels.length === 0) {
        throw httpError.badRequest("Chưa cấu hình danh mục cấp kho");
    }

    const maxOrder = Math.max(...levels.map((l) => l.levelOrder));
    const minOrder = Math.min(...levels.map((l) => l.levelOrder));

    if (!levelId) {
        return {
            levels,
            level: null,
            isLocation: true,
            isTopLevel: false,
            isBottomLevel: false,
            maxOrder,
            minOrder,
        };
    }

    const level = levels.find((l) => l.id === levelId);
    if (!level) {
        throw httpError.badRequest("Cấp kho không hợp lệ");
    }

    return {
        levels,
        level,
        isLocation: false,
        isTopLevel: level.levelOrder === minOrder,
        isBottomLevel: level.levelOrder === maxOrder,
        maxOrder,
        minOrder,
    };
}

function normalizeOptionalString(value: string | null | undefined) {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export const ItemService = {
    async list(params: { parentId?: string | null }) {
        if (params.parentId === undefined || params.parentId === null) {
            const items = await db
                .select()
                .from(physicalWarehouseItems)
                .where(
                    and(
                        isNull(physicalWarehouseItems.parentId),
                        isNull(physicalWarehouseItems.levelId),
                    ),
                )
                .orderBy(asc(physicalWarehouseItems.name));
            return { items };
        }

        const items = await db
            .select()
            .from(physicalWarehouseItems)
            .where(eq(physicalWarehouseItems.parentId, params.parentId))
            .orderBy(asc(physicalWarehouseItems.name));
        return { items };
    },

    async get(id: string) {
        const record = await getItemOrThrow(id);
        return { record };
    },

    async tree(rootId: string) {
        await getItemOrThrow(rootId);
        const descendantIds = await collectDescendantIds(rootId);
        const items = await db
            .select()
            .from(physicalWarehouseItems)
            .where(inArray(physicalWarehouseItems.id, descendantIds));

        const tree = buildTree(items, rootId);
        return { tree };
    },

    async stats(rootId: string) {
        await getItemOrThrow(rootId);
        const levels = await listLevelsOrdered();
        const descendantIds = await collectDescendantIds(rootId);

        const items = await db
            .select()
            .from(physicalWarehouseItems)
            .where(inArray(physicalWarehouseItems.id, descendantIds));

        const countsByLevelId = new Map<string, number>();
        let locationCount = 0;
        let totalCapacity = 0;
        let bottomLevelCount = 0;
        let overloadedCount = 0;

        const maxOrder = levels.length > 0
            ? Math.max(...levels.map((l) => l.levelOrder))
            : 0;
        const bottomLevel = levels.find((l) => l.levelOrder === maxOrder);

        for (const item of items) {
            if (!item.levelId) {
                locationCount += 1;
                continue;
            }
            countsByLevelId.set(
                item.levelId,
                (countsByLevelId.get(item.levelId) ?? 0) + 1,
            );

            if (bottomLevel && item.levelId === bottomLevel.id) {
                bottomLevelCount += 1;
                if (item.capacity != null) {
                    totalCapacity += item.capacity;
                }
                // used fill not tracked until dossiers are linked; treat used as 0
                if (item.capacity != null && item.capacity < 0) {
                    overloadedCount += 1;
                }
            }
        }

        const levelStats = levels.map((level) => ({
            levelId: level.id,
            levelName: level.levelName,
            levelOrder: level.levelOrder,
            count: countsByLevelId.get(level.id) ?? 0,
        }));

        const fillRate = totalCapacity > 0 ? 0 : 0;

        return {
            stats: {
                locationCount,
                levelStats,
                bottomLevelCount,
                totalCapacity,
                usedCapacity: 0,
                fillRate,
                overloadedCount,
            },
        };
    },

    async create(input: CreateItemInput) {
        const parentId = input.parentId ?? null;
        const levelId = input.levelId ?? null;
        const rules = await resolveLevelRules(levelId);

        if (rules.isLocation) {
            if (parentId != null) {
                throw httpError.badRequest("Địa điểm phải là nút gốc (không có parent)");
            }
            if (input.address) {
                throw httpError.badRequest("Địa điểm không có trường địa chỉ");
            }
            if (input.capacity != null) {
                throw httpError.badRequest("Địa điểm không có trường sức chứa");
            }
        } else {
            if (!parentId) {
                throw httpError.badRequest("Mục kho phải thuộc một nút cha");
            }
            const parent = await getItemOrThrow(parentId);
            const parentRules = await resolveLevelRules(parent.levelId);

            if (parentRules.isLocation) {
                if (!rules.isTopLevel) {
                    throw httpError.badRequest(
                        "Dưới địa điểm chỉ được tạo cấp cao nhất",
                    );
                }
            } else if (parentRules.level && rules.level) {
                if (rules.level.levelOrder !== parentRules.level.levelOrder + 1) {
                    throw httpError.badRequest(
                        "Cấp con phải liền kề cấp cha",
                    );
                }
            }

            if (!rules.isTopLevel && input.address) {
                throw httpError.badRequest("Chỉ cấp cao nhất mới có địa chỉ");
            }
            if (!rules.isTopLevel && input.imageUrl) {
                throw httpError.badRequest("Chỉ địa điểm và cấp cao nhất mới có ảnh");
            }
            if (!rules.isBottomLevel && input.capacity != null) {
                throw httpError.badRequest("Chỉ cấp thấp nhất mới có sức chứa");
            }
            if (rules.isBottomLevel && input.capacity == null) {
                throw httpError.badRequest("Cấp thấp nhất bắt buộc có sức chứa");
            }
        }

        const [record] = await db
            .insert(physicalWarehouseItems)
            .values({
                parentId,
                levelId,
                name: input.name.trim(),
                imageUrl: rules.isLocation || rules.isTopLevel
                    ? normalizeOptionalString(input.imageUrl)
                    : null,
                address: rules.isTopLevel
                    ? normalizeOptionalString(input.address)
                    : null,
                capacity: rules.isBottomLevel ? (input.capacity ?? null) : null,
            })
            .returning();

        return { record, status: "created" as const };
    },

    async update(id: string, input: UpdateItemInput) {
        const existing = await getItemOrThrow(id);
        const rules = await resolveLevelRules(existing.levelId);

        if (input.address !== undefined && !rules.isTopLevel) {
            throw httpError.badRequest("Chỉ cấp cao nhất mới có địa chỉ");
        }
        if (input.imageUrl !== undefined && !rules.isLocation && !rules.isTopLevel) {
            throw httpError.badRequest("Chỉ địa điểm và cấp cao nhất mới có ảnh");
        }
        if (input.capacity !== undefined && !rules.isBottomLevel) {
            throw httpError.badRequest("Chỉ cấp thấp nhất mới có sức chứa");
        }
        if (
            rules.isBottomLevel &&
            input.capacity !== undefined &&
            input.capacity == null
        ) {
            throw httpError.badRequest("Cấp thấp nhất bắt buộc có sức chứa");
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
                ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
                updatedAt: new Date(),
            })
            .where(eq(physicalWarehouseItems.id, id))
            .returning();

        return { record, status: "updated" as const };
    },

    async delete(id: string) {
        const existing = await getItemOrThrow(id);
        // FK cascade deletes children
        await db
            .delete(physicalWarehouseItems)
            .where(eq(physicalWarehouseItems.id, id));
        return { record: existing, status: "deleted" as const };
    },

    async countChildren(parentId: string) {
        const [row] = await db
            .select({ value: count() })
            .from(physicalWarehouseItems)
            .where(eq(physicalWarehouseItems.parentId, parentId));
        return row?.value ?? 0;
    },
};
