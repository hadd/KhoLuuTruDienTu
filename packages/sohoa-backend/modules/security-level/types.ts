import { t } from "elysia";

export const securityLevelEntitySchema = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.String(),
    levelOrder: t.Number(),
    hasPassword: t.Optional(t.Boolean()),
    isActive: t.Boolean(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
    deletedAt: t.Union([t.Date(), t.Null()]),
});

export const createSecurityLevelSchema = t.Object({
    name: t.String({ maxLength: 255, minLength: 1, description: "Tên cấp độ bảo mật" }),
    description: t.Optional(t.String()),
    levelOrder: t.Number({ minimum: 1, multipleOf: 1, description: "Thứ tự cấp độ (số nguyên >= 1)" }),
    isActive: t.Optional(t.Boolean()),
});

export const updateSecurityLevelSchema = t.Object({
    name: t.Optional(t.String({ maxLength: 255, minLength: 1 })),
    description: t.Optional(t.String()),
    levelOrder: t.Optional(t.Number({ minimum: 1, multipleOf: 1 })),
    isActive: t.Optional(t.Boolean()),
});

export const patchSecurityLevelRulesSchema = t.Object({
    confirmLooser: t.Optional(t.Boolean()),
    password: t.Optional(t.Union([t.String({ minLength: 1 }), t.Null()])),
    clearPassword: t.Optional(t.Boolean()),
    rules: t.Array(t.Object({
        ruleKey: t.String({ minLength: 1 }),
        isOverridden: t.Boolean(),
        value: t.Optional(t.Any()),
    })),
});

export const verifySecurityLevelAccessSchema = t.Object({
    securityLevelId: t.String({ format: "uuid" }),
    password: t.String({ minLength: 1 }),
});

export const permissionDefEntitySchema = t.Object({
    id: t.String(),
    key: t.String(),
    name: t.String(),
    description: t.String(),
    isSystem: t.Boolean(),
    isActive: t.Boolean(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
    deletedAt: t.Union([t.Date(), t.Null()]),
});

export const createPermissionDefSchema = t.Object({
    key: t.String({ minLength: 1, maxLength: 64, pattern: "^[a-z][a-z0-9_]*$" }),
    name: t.String({ minLength: 1, maxLength: 100 }),
    description: t.Optional(t.String()),
    isActive: t.Optional(t.Boolean()),
});

export const updatePermissionDefSchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    description: t.Optional(t.String()),
    isActive: t.Optional(t.Boolean()),
});

export type CreateSecurityLevelInput = typeof createSecurityLevelSchema.static;
export type UpdateSecurityLevelInput = typeof updateSecurityLevelSchema.static;
export type PatchSecurityLevelRulesInput = typeof patchSecurityLevelRulesSchema.static;
export type CreatePermissionDefInput = typeof createPermissionDefSchema.static;
export type UpdatePermissionDefInput = typeof updatePermissionDefSchema.static;
