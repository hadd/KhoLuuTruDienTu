import { t } from "elysia";

export const createGroupBodySchema = t.Object({
    id: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    name: t.String({ minLength: 1, maxLength: 255 }),
    description: t.Optional(t.String({ maxLength: 2000 })),
    roundNumber: t.Optional(t.Integer({ minimum: 1, maximum: 5, default: 3 })),
    editorIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
});

export const updateGroupBodySchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
    description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
    roundNumber: t.Optional(t.Integer({ minimum: 1, maximum: 5 })),
    editorIds: t.Optional(t.Array(t.String({ format: "uuid" }), { minItems: 1 })),
});

export const assignByFolderToGroupBodySchema = t.Object({
    folderId: t.String({ format: "uuid" }),
    dossiersPerEditor: t.Integer({ minimum: 1 }),
});
