import { t } from "elysia";

export const documentTypeEntitySchema = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.String(),
    retentionPeriodId: t.Union([t.String(), t.Null()]),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
});

export const createDocumentTypeSchema = t.Object({
    id: t.String({ maxLength: 50, minLength: 1, description: "Mã loại tài liệu" }),
    name: t.String({ maxLength: 255 }),
    description: t.Optional(t.String()),
    retentionPeriodId: t.Optional(t.Union([t.String(), t.Null()])),
});

export const updateDocumentTypeSchema = t.Object({
    name: t.Optional(t.String({ maxLength: 255 })),
    description: t.Optional(t.String()),
    retentionPeriodId: t.Optional(t.Union([t.String(), t.Null()])),
});

export type CreateDocumentTypeInput = typeof createDocumentTypeSchema.static;
export type UpdateDocumentTypeInput = typeof updateDocumentTypeSchema.static;
