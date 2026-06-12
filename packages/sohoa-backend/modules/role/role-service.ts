import { httpError } from "@shared/common-lib";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { roles, type Role } from "../../db/schemas/role.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import { PERMISSION_CATALOG } from "../auth/permission-catalog.ts";
import {
    hasPermissionInRules,
    parseRoleRules,
    parseRulesForResponse,
    serializeRoleRules,
    validateRoleRulesInput,
    type RoleRules,
} from "../auth/permission-resolver.ts";

export interface CreateRoleInput {
    id: string;
    name: string;
    description?: string;
}

const EMPTY_ROLE_RULES: RoleRules = { permissions: [], restrictions: [] };

export interface UpdateRoleInput {
    name?: string;
    description?: string;
    rules?: RoleRules;
}

function formatRole(role: Role) {
    const parsedRules = parseRulesForResponse(role.rules);
    return {
        ...role,
        rules: parsedRules,
        rulesRaw: role.rules,
    };
}

function assertValidRules(rules: RoleRules) {
    const errors = validateRoleRulesInput(rules);
    if (errors.length > 0) {
        throw httpError.badRequest(errors.join("; "));
    }
}

export const RoleService = {
    getPermissionCatalog() {
        return PERMISSION_CATALOG;
    },

    async list() {
        const items = await db.query.roles.findMany({
            where: isNull(roles.deletedAt),
            with: {
                userRoles: {
                    where: isNull(userRoles.expiredAt),
                },
            },
        });
        return items.map(formatRole);
    },

    async get(roleId: string) {
        const role = await db.query.roles.findFirst({
            where: and(eq(roles.id, roleId), isNull(roles.deletedAt)),
            with: {
                userRoles: {
                    where: isNull(userRoles.expiredAt),
                },
            },
        });
        if (!role) {
            throw httpError.notFound(`Role "${roleId}" not found`);
        }
        return formatRole(role);
    },

    async getPermissions(roleId: string) {
        const role = await db.query.roles.findFirst({
            where: and(eq(roles.id, roleId), isNull(roles.deletedAt)),
            columns: { id: true, name: true, rules: true, isBaseRole: true },
        });
        if (!role) {
            throw httpError.notFound(`Role "${roleId}" not found`);
        }

        const rules = parseRulesForResponse(role.rules);
        const catalog = PERMISSION_CATALOG.filter((item) =>
            hasPermissionInRules(rules, item.key)
        );

        return {
            roleId: role.id,
            roleName: role.name,
            isBaseRole: role.isBaseRole,
            rules,
            catalog,
        };
    },

    async updatePermissions(roleId: string, rules: RoleRules) {
        assertValidRules(rules);

        const existing = await db.query.roles.findFirst({
            where: and(eq(roles.id, roleId), isNull(roles.deletedAt)),
            columns: { id: true },
        });
        if (!existing) {
            throw httpError.notFound(`Role "${roleId}" not found`);
        }

        const [updated] = await db.update(roles)
            .set({
                rules: serializeRoleRules(rules),
                updatedAt: new Date(),
            })
            .where(eq(roles.id, roleId))
            .returning();

        return this.getPermissions(updated.id);
    },

    async create(input: CreateRoleInput) {
        if (!input.id?.trim() || !input.name?.trim()) {
            throw httpError.badRequest("id and name are required");
        }

        const existing = await db.query.roles.findFirst({
            where: eq(roles.id, input.id.trim()),
        });
        if (existing) {
            throw httpError.conflict(`Role "${input.id}" already exists`);
        }

        const [created] = await db.insert(roles).values({
            id: input.id.trim(),
            name: input.name.trim(),
            description: input.description?.trim() || null,
            rules: serializeRoleRules(EMPTY_ROLE_RULES),
            isBaseRole: false,
        }).returning();

        return formatRole(created);
    },

    async update(roleId: string, input: UpdateRoleInput) {
        const existing = await db.query.roles.findFirst({
            where: and(eq(roles.id, roleId), isNull(roles.deletedAt)),
        });
        if (!existing) {
            throw httpError.notFound(`Role "${roleId}" not found`);
        }

        const nextRules = input.rules ?? parseRoleRules(existing.rules);
        if (input.rules) {
            assertValidRules(nextRules);
        }

        const [updated] = await db.update(roles)
            .set({
                name: input.name?.trim() ?? existing.name,
                description: input.description !== undefined
                    ? (input.description?.trim() || null)
                    : existing.description,
                rules: serializeRoleRules(nextRules),
                updatedAt: new Date(),
            })
            .where(eq(roles.id, roleId))
            .returning();

        return formatRole(updated);
    },

    async delete(roleId: string) {
        const existing = await db.query.roles.findFirst({
            where: and(eq(roles.id, roleId), isNull(roles.deletedAt)),
        });
        if (!existing) {
            throw httpError.notFound(`Role "${roleId}" not found`);
        }
        if (existing.isBaseRole) {
            throw httpError.forbidden("Base roles cannot be deleted");
        }

        const activeAssignments = await db.query.userRoles.findFirst({
            where: and(eq(userRoles.roleId, roleId), isNull(userRoles.expiredAt)),
            columns: { id: true },
        });
        if (activeAssignments) {
            throw httpError.conflict("Role is assigned to active users");
        }

        const [deleted] = await db.update(roles)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(roles.id, roleId))
            .returning();

        return formatRole(deleted);
    },
};
