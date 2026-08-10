import type { PhysicalPlacementSearchEnrichment } from "./physical-placement-service.ts";

export type PhysicalWarehouseSearchDedupeItem = {
    entityId: string;
    title?: string;
    fondId?: string | null;
    score?: number;
    matches?: unknown[];
    physicalPlacement?: PhysicalPlacementSearchEnrichment | null;
};

/**
 * Đã xếp kho: gộp hit trùng cùng ô + tên + phông (ES/DB có thể trả 2 entityId cho một hồ sơ).
 * Chưa xếp kho: chỉ gộp theo entityId — nhiều hồ sơ trùng tên vẫn hiển thị riêng.
 */
export function physicalWarehouseSearchDedupeKey(
    item: PhysicalWarehouseSearchDedupeItem,
): string {
    const physicalItemId = item.physicalPlacement?.physicalItemId;
    if (physicalItemId) {
        const title = String(item.title ?? "").trim().toLowerCase();
        const fond = String(item.fondId ?? "");
        return `placed:${physicalItemId}:${title}:${fond}`;
    }
    return `entity:${item.entityId}`;
}

export function dedupePhysicalWarehouseSearchItems<
    T extends PhysicalWarehouseSearchDedupeItem,
>(items: Array<T>): Array<T> {
    const byKey = new Map<string, T>();
    for (const item of items) {
        const key = physicalWarehouseSearchDedupeKey(item);
        const existing = byKey.get(key);
        if (!existing) {
            byKey.set(key, item);
            continue;
        }
        const keepCurrent = (item.score ?? 0) > (existing.score ?? 0);
        const primary = keepCurrent ? item : existing;
        const secondary = keepCurrent ? existing : item;
        byKey.set(key, {
            ...primary,
            matches: [
                ...(secondary.matches ?? []),
                ...(primary.matches ?? []),
            ],
        } as T);
    }
    return [...byKey.values()];
}
