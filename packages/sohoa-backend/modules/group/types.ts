import { t } from "elysia";

const qcLevelSchema = t.Object({
    userIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
});

export const createGroupBodySchema = t.Object({
    id: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    name: t.String({ minLength: 1, maxLength: 255 }),
    description: t.Optional(t.String({ maxLength: 2000 })),
    roundNumber: t.Optional(t.Integer({ minimum: 0, maximum: 5, default: 3 })),
    editorIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
    leaderId: t.Optional(t.String({ format: "uuid" })),
    qcLevels: t.Optional(t.Array(qcLevelSchema, { minItems: 1, maxItems: 5 })),
});

export const updateGroupBodySchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
    description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
    roundNumber: t.Optional(t.Integer({ minimum: 0, maximum: 5 })),
    editorIds: t.Optional(t.Array(t.String({ format: "uuid" }), { minItems: 1 })),
    leaderId: t.Optional(t.String({ format: "uuid" })),
    qcLevels: t.Optional(t.Array(qcLevelSchema, { minItems: 1, maxItems: 5 })),
});

export const assignByFolderToGroupBodySchema = t.Object({
    folderId: t.String({ format: "uuid" }),
    dossiersPerEditor: t.Integer({ minimum: 1 }),
});

export const syncQcWorkflowBodySchema = t.Object({
    folderId: t.Optional(t.String({ format: "uuid" })),
});

export const metadataPermissionConfigBodySchema = t.Object({
    permissionConfigId: t.Nullable(t.String({ format: "uuid" })),
});

export const permissionAssignmentsBodySchema = t.Object({
    assignments: t.Array(
        t.Object({
            slotCode: t.String({ minLength: 1 }),
            editorIds: t.Array(t.String({ format: "uuid" })),
        }),
        { minItems: 1 },
    ),
});
