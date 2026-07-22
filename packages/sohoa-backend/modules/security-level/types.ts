import { t } from "elysia";

export const securityLevelEntitySchema = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.String(),
    levelOrder: t.Number(),
    requireEncryption: t.Boolean(),
    requireWatermark: t.Boolean(),
    exportRoleIds: t.Array(t.String()),
    isActive: t.Boolean(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
    deletedAt: t.Union([t.Date(), t.Null()]),
});

export const createSecurityLevelSchema = t.Object({
    name: t.String({ maxLength: 255, minLength: 1, description: "Tên mức độ bảo mật" }),
    description: t.Optional(t.String()),
    levelOrder: t.Integer({ minimum: 1, description: "Thứ tự mức độ (càng cao càng nhạy cảm)" }),
    requireEncryption: t.Optional(t.Boolean()),
    requireWatermark: t.Optional(t.Boolean()),
    exportRoleIds: t.Optional(t.Array(t.String(), { description: "Danh sách role được phép xuất tài liệu" })),
    isActive: t.Optional(t.Boolean()),
});

export const updateSecurityLevelSchema = t.Object({
    name: t.Optional(t.String({ maxLength: 255, minLength: 1 })),
    description: t.Optional(t.String()),
    levelOrder: t.Optional(t.Integer({ minimum: 1 })),
    requireEncryption: t.Optional(t.Boolean()),
    requireWatermark: t.Optional(t.Boolean()),
    exportRoleIds: t.Optional(t.Array(t.String())),
    isActive: t.Optional(t.Boolean()),
});

export type CreateSecurityLevelInput = typeof createSecurityLevelSchema.static;
export type UpdateSecurityLevelInput = typeof updateSecurityLevelSchema.static;
