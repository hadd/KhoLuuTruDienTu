import { t } from "elysia";

export const retentionPeriodEntitySchema = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.String(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
});

export const createRetentionPeriodSchema = t.Object({
    id: t.String({ maxLength: 50, minLength: 1, description: "Mã thời hạn lưu trữ" }),
    name: t.String({ maxLength: 255 }),
    description: t.Optional(t.String()),
});

export const updateRetentionPeriodSchema = t.Object({
    name: t.Optional(t.String({ maxLength: 255 })),
    description: t.Optional(t.String()),
});
