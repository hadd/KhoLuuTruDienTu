import { t } from "elysia";

export const uploadPointBodySchema = t.Object({
    sessionId: t.String({ minLength: 1 }),
    docSlug: t.Optional(t.String()),
    fileName: t.String({ minLength: 1 }),
    expiry: t.Optional(t.Number({ minimum: 60, maximum: 604800 })),
    maxFileSize: t.Optional(t.Number({ minimum: 1 })),
    contentType: t.Optional(t.String()),
});

export const presignedGetBodySchema = t.Object({
    key: t.String({ minLength: 1 }),
    expiry: t.Optional(t.Number({ minimum: 60, maximum: 604800 })),
});

export const listSessionQuerySchema = t.Object({
    sessionId: t.String({ minLength: 1 }),
});

export const assemblePdfBodySchema = t.Object({
    sessionId: t.String({ minLength: 1 }),
    docSlug: t.String({ minLength: 1 }),
    /** User-visible document name — PDF file is named from this (not document.pdf). */
    displayName: t.Optional(t.String({ minLength: 1 })),
});

export const reorderPagesBodySchema = t.Object({
    sessionId: t.String({ minLength: 1 }),
    docSlug: t.String({ minLength: 1 }),
    pageKeys: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
});

export const deletePageBodySchema = t.Object({
    key: t.String({ minLength: 1 }),
});

export const deletePagesBodySchema = t.Object({
    keys: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
});

export const deleteDocumentBodySchema = t.Object({
    sessionId: t.String({ minLength: 1 }),
    docSlug: t.String({ minLength: 1 }),
});

export const organizeMoveBodySchema = t.Object({
    sessionId: t.String({ minLength: 1 }),
    sourceKey: t.String({ minLength: 1 }),
    destKey: t.String({ minLength: 1 }),
});

export const organizeRenameFolderBodySchema = t.Object({
    sessionId: t.String({ minLength: 1 }),
    folderPath: t.String({ minLength: 1 }),
    newName: t.String({ minLength: 1 }),
});

export const organizeRenamePdfBodySchema = t.Object({
    sessionId: t.String({ minLength: 1 }),
    pdfKey: t.String({ minLength: 1 }),
    newName: t.String({ minLength: 1 }),
});

export const promoteBodySchema = t.Object({
    projectCode: t.String({ minLength: 1 }),
    sessionId: t.String({ minLength: 1 }),
    /** Full MinIO folder path, e.g. raw/PROJECT_CODE/Ho_so_A */
    targetFolderPath: t.String({ minLength: 1 }),
    /** When promoting a draft organize folder, all pdfKeys must live under this path. */
    organizeFolderPath: t.Optional(t.String({ minLength: 1 })),
    pdfKeys: t.Optional(t.Array(t.String({ minLength: 1 }))),
    folderPaths: t.Optional(t.Array(t.String({ minLength: 1 }))),
    cleanup: t.Optional(t.Boolean()),
});

export const deleteSessionBodySchema = t.Object({
    sessionId: t.String({ minLength: 1 }),
});
