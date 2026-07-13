import { t } from "elysia";

export const physicalWarehouseLevelEntitySchema = t.Object({
    id: t.String(),
    levelName: t.String(),
    levelOrder: t.Number(),
    createdAt: t.Union([t.Date(), t.String()]),
    updatedAt: t.Union([t.Date(), t.String()]),
});

export const replaceLevelsSchema = t.Object({
    levels: t.Array(
        t.Object({
            levelName: t.String({ minLength: 1, maxLength: 255 }),
            levelOrder: t.Number({ minimum: 1 }),
        }),
        { minItems: 1 },
    ),
});

export const physicalWarehouseItemEntitySchema = t.Object({
    id: t.String(),
    parentId: t.Union([t.String(), t.Null()]),
    levelId: t.Union([t.String(), t.Null()]),
    name: t.String(),
    imageUrl: t.Union([t.String(), t.Null()]),
    address: t.Union([t.String(), t.Null()]),
    capacity: t.Union([t.Number(), t.Null()]),
    createdAt: t.Union([t.Date(), t.String()]),
    updatedAt: t.Union([t.Date(), t.String()]),
});

export const createItemSchema = t.Object({
    parentId: t.Optional(t.Union([t.String(), t.Null()])),
    levelId: t.Optional(t.Union([t.String(), t.Null()])),
    name: t.String({ minLength: 1, maxLength: 500 }),
    imageUrl: t.Optional(t.Union([t.String(), t.Null()])),
    address: t.Optional(t.Union([t.String(), t.Null()])),
    capacity: t.Optional(t.Union([t.Number({ minimum: 0 }), t.Null()])),
});

export const updateItemSchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
    imageUrl: t.Optional(t.Union([t.String(), t.Null()])),
    address: t.Optional(t.Union([t.String(), t.Null()])),
    capacity: t.Optional(t.Union([t.Number({ minimum: 0 }), t.Null()])),
});

export type ReplaceLevelsInput = typeof replaceLevelsSchema.static;
export type CreateItemInput = typeof createItemSchema.static;
export type UpdateItemInput = typeof updateItemSchema.static;
