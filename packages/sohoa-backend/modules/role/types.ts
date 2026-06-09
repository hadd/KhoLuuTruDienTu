import { t } from "elysia";

export const roleRulesSchema = t.Object({
    permissions: t.Array(t.String()),
    restrictions: t.Array(t.String()),
});

export const createRoleBodySchema = t.Object({
    id: t.String({ minLength: 1 }),
    name: t.String({ minLength: 1 }),
    description: t.Optional(t.String()),
    rules: roleRulesSchema,
});

export const updateRoleBodySchema = t.Object({
    name: t.Optional(t.String({ minLength: 1 })),
    description: t.Optional(t.String()),
    rules: t.Optional(roleRulesSchema),
});

export const updateRolePermissionsBodySchema = roleRulesSchema;
