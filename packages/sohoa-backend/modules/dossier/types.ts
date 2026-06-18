import { t } from "elysia";
import {
    assignmentStatusSchema,
    dossierStatusSchema,
    entityTypeSchema,
    workerRoleSchema,
} from "../../db/schemas/workflow-constants.ts";

export { dossierStatusSchema, entityTypeSchema };

export const dossierEntitySchema = t.Object({
    id: t.String(),
    folderId: t.String(),
    folderPath: t.String(),
    name: t.String(),
    entityType: entityTypeSchema,
    status: dossierStatusSchema,
    requiredQcCount: t.Number(),
    currentQcStep: t.Number(),
    rejectCount: t.Number(),
    lastRejectNotes: t.Union([t.String(), t.Null()]),
    ocrMetadataKey: t.Union([t.String(), t.Null()]),
    currentMetadataKey: t.Union([t.String(), t.Null()]),
    projectCode: t.Union([t.String(), t.Null()]),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
    deletedAt: t.Union([t.Date(), t.Null()]),
});

export const createDossierSchema = t.Object({
    folderId: t.String(),
    folderPath: t.String({ maxLength: 500 }),
    name: t.String({ maxLength: 255 }),
    entityType: entityTypeSchema,
    projectCode: t.String({ minLength: 1, maxLength: 50 }),
    status: t.Optional(dossierStatusSchema),
    requiredQcCount: t.Optional(t.Number()),
    currentQcStep: t.Optional(t.Number()),
    rejectCount: t.Optional(t.Number()),
    lastRejectNotes: t.Optional(t.String()),
    ocrMetadataKey: t.Optional(t.String()),
    currentMetadataKey: t.Optional(t.String()),
});

export const updateDossierSchema = t.Object({
    folderId: t.Optional(t.String()),
    folderPath: t.Optional(t.String({ maxLength: 500 })),
    name: t.Optional(t.String({ maxLength: 255 })),
    entityType: t.Optional(entityTypeSchema),
    projectCode: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
    status: t.Optional(dossierStatusSchema),
    requiredQcCount: t.Optional(t.Number()),
    currentQcStep: t.Optional(t.Number()),
    rejectCount: t.Optional(t.Number()),
    lastRejectNotes: t.Optional(t.Union([t.String(), t.Null()])),
    ocrMetadataKey: t.Optional(t.Union([t.String(), t.Null()])),
    currentMetadataKey: t.Optional(t.Union([t.String(), t.Null()])),
});

export const createUploadPointBodySchema = t.Object({
    projectCode: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
    prefix: t.Optional(t.String()),
    expiry: t.Optional(t.Number({ minimum: 60, maximum: 604800 })),
    maxFileSize: t.Optional(t.Number({ minimum: 1 })),
    contentTypePrefix: t.Optional(t.String()),
});

export const createDocumentFromStorageBodySchema = t.Object({
    key: t.String({ minLength: 1 }),
    projectCode: t.String({ minLength: 1, maxLength: 50 }),
});

export const checkFilePathQuerySchema = t.Object({
    filePath: t.String({ minLength: 1 }),
});

export const assignDossierBodySchema = t.Object({
    assigneeId: t.String({ format: "uuid" }),
    role: workerRoleSchema,
});

export const assignByFolderIdBodySchema = t.Object({
    folderId: t.String({ format: "uuid" }),
    assigneeId: t.Optional(t.String({ format: "uuid" })),
    role: workerRoleSchema,
});

export const listAssignmentsByRoleQuerySchema = t.Object({
    role: workerRoleSchema,
    status: t.Optional(assignmentStatusSchema),
});
