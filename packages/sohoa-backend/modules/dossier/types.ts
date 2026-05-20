import { t } from "elysia";
import { dossierStatusSchema, entityTypeSchema } from "../../db/schemas/workflow-constants.ts";

export { dossierStatusSchema, entityTypeSchema };

export const dossierEntitySchema = t.Object({
    id: t.String(),
    folderId: t.String(),
    folderPath: t.String(),
    name: t.String(),
    entityType: entityTypeSchema,
    status: dossierStatusSchema,
    rejectCount: t.Number(),
    lastRejectNotes: t.Union([t.String(), t.Null()]),
    ocrMetadataKey: t.Union([t.String(), t.Null()]),
    currentMetadataKey: t.Union([t.String(), t.Null()]),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
});

export const createDossierSchema = t.Object({
    folderId: t.String(),
    folderPath: t.String({ maxLength: 500 }),
    name: t.String({ maxLength: 255 }),
    entityType: entityTypeSchema,
    status: t.Optional(dossierStatusSchema),
    lastRejectNotes: t.Optional(t.String()),
    ocrMetadataKey: t.Optional(t.String()),
    currentMetadataKey: t.Optional(t.String()),
});

export const updateDossierSchema = t.Object({
    folderId: t.Optional(t.String()),
    folderPath: t.Optional(t.String({ maxLength: 500 })),
    name: t.Optional(t.String({ maxLength: 255 })),
    entityType: t.Optional(entityTypeSchema),
    status: t.Optional(dossierStatusSchema),
    lastRejectNotes: t.Optional(t.Union([t.String(), t.Null()])),
    ocrMetadataKey: t.Optional(t.Union([t.String(), t.Null()])),
    currentMetadataKey: t.Optional(t.Union([t.String(), t.Null()])),
});

export const createUploadPointBodySchema = t.Object({
    prefix: t.Optional(t.String()),
    expiry: t.Optional(t.Number({ minimum: 60, maximum: 604800 })),
    maxFileSize: t.Optional(t.Number({ minimum: 1 })),
    contentTypePrefix: t.Optional(t.String()),
});

export const createDocumentFromStorageBodySchema = t.Object({
    key: t.String({ minLength: 1 }),
});

export const checkFilePathQuerySchema = t.Object({
    filePath: t.String({ minLength: 1 }),
});
