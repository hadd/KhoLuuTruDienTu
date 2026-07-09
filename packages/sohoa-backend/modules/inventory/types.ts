import { t } from "elysia";

export const inventoryEntitySchema = t.Object({
    id: t.String(),
    number: t.String(),
    name: t.String(),
    fondId: t.String(),
    submissionYear: t.Number(),
    submittingUnit: t.String(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
});

export const createInventorySchema = t.Object({
    id: t.String({ maxLength: 50, minLength: 1, description: "Mã mục lục" }),
    number: t.String({ maxLength: 100 }),
    name: t.String({ maxLength: 500 }),
    fondId: t.String({ description: "Mã phông lưu trữ" }),
    submissionYear: t.Number({ minimum: 1000, maximum: 9999 }),
    submittingUnit: t.String({ maxLength: 255 }),
});

export const updateInventorySchema = t.Object({
    number: t.Optional(t.String({ maxLength: 100 })),
    name: t.Optional(t.String({ maxLength: 500 })),
    fondId: t.Optional(t.String({ description: "Mã phông lưu trữ" })),
    submissionYear: t.Optional(t.Number({ minimum: 1000, maximum: 9999 })),
    submittingUnit: t.Optional(t.String({ maxLength: 255 })),
});
