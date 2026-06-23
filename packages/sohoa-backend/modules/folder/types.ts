import { t } from "elysia";
import { dossierStatusSchema, entityTypeSchema } from "../../db/schemas/workflow-constants.ts";
import { FolderBrowseNodeType } from "./folder-browse-constants.ts";

export const listDossierFilesQuerySchema = t.Object({
    status: t.Optional(t.Literal("draft")),
});

export const folderBrowseQuerySchema = t.Object({
    projectCode: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
});

export const folderEntitySchema = t.Object({
    id: t.String(),
    parentId: t.Union([t.String(), t.Null()]),
    folderPath: t.String(),
    folderName: t.String(),
    projectCode: t.Union([t.String(), t.Null()]),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
    deletedAt: t.Union([t.Date(), t.Null()]),
});

export const createFolderSchema = t.Object({
    parentId: t.Optional(t.String()),
    folderPath: t.String({ maxLength: 500 }),
    folderName: t.String({ maxLength: 255 }),
    projectCode: t.String({ minLength: 1, maxLength: 50 }),
});

export const updateFolderSchema = t.Object({
    parentId: t.Optional(t.Union([t.String(), t.Null()])),
    folderPath: t.Optional(t.String({ maxLength: 500 })),
    folderName: t.Optional(t.String({ maxLength: 255 })),
    projectCode: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
});

const browseFolderChildSchema = t.Object({
    id: t.String(),
    parentId: t.Union([t.String(), t.Null()]),
    folderPath: t.String(),
    folderName: t.String(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
    dossierId: t.Optional(t.String()),
    status: t.Optional(dossierStatusSchema),
    totalSizeKb: t.Number(),
});

export const browseDossierChildSchema = t.Object({
    id: t.String(),
    folderId: t.String(),
    folderPath: t.String(),
    name: t.String(),
    entityType: entityTypeSchema,
    status: dossierStatusSchema,
    totalSizeKb: t.Number(),
});

export const browseChildrenResponseSchema = t.Object({
    nodeType: t.Union([
        t.Literal(FolderBrowseNodeType.FOLDER),
        t.Literal(FolderBrowseNodeType.DOSSIER),
    ]),
    parentId: t.Optional(t.String()),
    totalSizeKb: t.Number(),
    children: t.Array(t.Union([browseFolderChildSchema, browseDossierChildSchema])),
});

export const dossierFileChildSchema = t.Object({
    id: t.String(),
    dossierId: t.String(),
    fileName: t.String(),
    filePath: t.String(),
    fileSizeKb: t.Union([t.Number(), t.Null()]),
    createdAt: t.Union([t.Date(), t.Null()]),
    fileUrl: t.String(),
    searchablePdfPath: t.Union([t.String(), t.Null()]),
    searchablePdfUrl: t.Union([t.String(), t.Null()]),
});

export const dossierFilesResponseSchema = t.Object({
    nodeType: t.Literal(FolderBrowseNodeType.FILE),
    dossierId: t.String(),
    children: t.Array(dossierFileChildSchema),
});
