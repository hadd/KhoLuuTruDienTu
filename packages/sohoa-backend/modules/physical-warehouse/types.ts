import { t } from "elysia";

export const physicalWarehouseItemEntitySchema = t.Object({
    id: t.String(),
    parentId: t.Union([t.String(), t.Null()]),
    name: t.String(),
    imageUrl: t.Union([t.String(), t.Null()]),
    address: t.Union([t.String(), t.Null()]),
    capacity: t.Union([t.Number(), t.Null()]),
    createdAt: t.Union([t.Date(), t.String()]),
    updatedAt: t.Union([t.Date(), t.String()]),
    childCount: t.Optional(t.Number()),
    imageDisplayUrl: t.Optional(t.Union([t.String(), t.Null()])),
    isBottomLevel: t.Optional(t.Boolean()),
});

export const createItemSchema = t.Object({
    parentId: t.Optional(t.Union([t.String(), t.Null()])),
    name: t.String({ minLength: 1, maxLength: 500 }),
    imageUrl: t.Optional(t.Union([t.String(), t.Null()])),
    address: t.Optional(t.Union([t.String(), t.Null()])),
    /** Set to create a storage unit (fixed bottom level). Omit/null for intermediate. */
    capacity: t.Optional(t.Union([t.Number({ minimum: 0 }), t.Null()])),
});

export const updateItemSchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
    imageUrl: t.Optional(t.Union([t.String(), t.Null()])),
    address: t.Optional(t.Union([t.String(), t.Null()])),
    capacity: t.Optional(t.Union([t.Number({ minimum: 0 }), t.Null()])),
    parentId: t.Optional(t.String()),
});

export const reparentItemSchema = t.Object({
    newParentId: t.String(),
});

export type CreateItemInput = typeof createItemSchema.static;
export type UpdateItemInput = typeof updateItemSchema.static;
