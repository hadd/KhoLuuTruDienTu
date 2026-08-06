import { t } from "elysia";

export const physicalWarehouseItemEntitySchema = t.Object({
    id: t.String(),
    parentId: t.Union([t.String(), t.Null()]),
    name: t.String(),
    imageUrl: t.Union([t.String(), t.Null()]),
    address: t.Union([t.String(), t.Null()]),
    mapsUrl: t.Union([t.String(), t.Null()]),
    /** isBottomLevel = true → storage capacity. isBottomLevel = false → max direct children. */
    capacity: t.Union([t.Number(), t.Null()]),
    createdAt: t.Union([t.Date(), t.String()]),
    updatedAt: t.Union([t.Date(), t.String()]),
    childCount: t.Optional(t.Number()),
    imageDisplayUrl: t.Optional(t.Union([t.String(), t.Null()])),
    /** Explicit discriminator: true = storage unit ("ô chứa"), false = location/warehouse/intermediate. */
    isBottomLevel: t.Boolean(),
});

export const createItemSchema = t.Object({
    parentId: t.Optional(t.Union([t.String(), t.Null()])),
    name: t.String({ minLength: 1, maxLength: 500 }),
    imageUrl: t.Optional(t.Union([t.String(), t.Null()])),
    address: t.Optional(t.Union([t.String(), t.Null()])),
    mapsUrl: t.Optional(t.Union([t.String(), t.Null()])),
    /** true = create a storage unit ("ô chứa", fixed bottom level, no children allowed). */
    isBottomLevel: t.Boolean(),
    /**
     * isBottomLevel = true  → storage capacity for this box.
     * isBottomLevel = false → max number of direct children this level may hold.
     * Required (natural number ≥ 1) for dãy/kệ/tầng/hộp; omit/null only for warehouse.
     */
    capacity: t.Optional(t.Union([t.Integer({ minimum: 1 }), t.Null()])),
});

export const updateItemSchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
    imageUrl: t.Optional(t.Union([t.String(), t.Null()])),
    address: t.Optional(t.Union([t.String(), t.Null()])),
    mapsUrl: t.Optional(t.Union([t.String(), t.Null()])),
    /** Dual meaning — see createItemSchema. isBottomLevel cannot be changed after creation. */
    capacity: t.Optional(t.Union([t.Integer({ minimum: 1 }), t.Null()])),
    parentId: t.Optional(t.String()),
});

export const reparentItemSchema = t.Object({
    newParentId: t.String(),
});

export type CreateItemInput = typeof createItemSchema.static;
export type UpdateItemInput = typeof updateItemSchema.static;