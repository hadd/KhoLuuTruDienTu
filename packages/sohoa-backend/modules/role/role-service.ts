import { httpError } from "@shared/common-lib";
import { and, eq, isNull, ne, type SQL } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { roles, type Role } from "../../db/schemas/role.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import { PERMISSION_CATALOG } from "../auth/permission-catalog.ts";
import { authHelper, AuthRole } from "../auth/auth-helper.ts";
import { type UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { ProfileService } from "../profile/profile-service.ts";
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
    let hiddenModules: string[] = [];
    try {
        if (role.hiddenModules) {
            hiddenModules = JSON.parse(role.hiddenModules);
        }
    } catch {
        // ignore
    }
    return {
        ...role,
        hiddenModules,
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
    getPermissionCatalog(profile?: UserWithRoles) {
        let catalog = PERMISSION_CATALOG;
        if (profile && !authHelper.isAdmin(profile)) {
            const userHiddenModules = authHelper.getHiddenModules(profile);
            if (userHiddenModules.length > 0) {
                catalog = catalog.filter(c => !userHiddenModules.includes(c.module));
            }
        }
        return catalog;
    },

    async list(profile?: UserWithRoles) {
        let rolesWhere: SQL<unknown> | undefined = isNull(roles.deletedAt);
        if (profile && !authHelper.isAdmin(profile)) {
            rolesWhere = and(rolesWhere, ne(roles.id, AuthRole.ADMIN));
        }

        const items = await db.query.roles.findMany({
            where: rolesWhere,
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

    async getPermissions(roleId: string, profile: UserWithRoles) {
        const role = await db.query.roles.findFirst({
            where: and(eq(roles.id, roleId), isNull(roles.deletedAt)),
            columns: { id: true, name: true, rules: true, isBaseRole: true, hiddenModules: true },
        });
        if (!role) {
            throw httpError.notFound(`Role "${roleId}" not found`);
        }

        let rules = parseRulesForResponse(role.rules);
        let catalog = PERMISSION_CATALOG.filter((item) =>
            hasPermissionInRules(rules, item.key)
        );

        let hiddenModules: string[] = [];
        try {
            if (role.hiddenModules) {
                hiddenModules = JSON.parse(role.hiddenModules);
            }
        } catch { }

        const userHiddenModules = authHelper.getHiddenModules(profile);
        if (userHiddenModules.length > 0) {
            catalog = catalog.filter(c => !userHiddenModules.includes(c.module));
            
            const visiblePermissions = rules.permissions.filter(p => {
                const def = PERMISSION_CATALOG.find(c => c.key === p);
                return def ? !userHiddenModules.includes(def.module) : true;
            });
            const visibleRestrictions = rules.restrictions.filter(p => {
                const def = PERMISSION_CATALOG.find(c => c.key === p);
                return def ? !userHiddenModules.includes(def.module) : true;
            });
            rules = { permissions: visiblePermissions, restrictions: visibleRestrictions };
        }

        return {
            roleId: role.id,
            roleName: role.name,
            isBaseRole: role.isBaseRole,
            hiddenModules,
            rules,
            catalog,
        };
    },

    async updatePermissions(roleId: string, input: { permissions: string[]; restrictions: string[]; hiddenModules?: string[] }, profile: UserWithRoles) {
        const rules = { permissions: input.permissions, restrictions: input.restrictions };
        assertValidRules(rules);

        const existing = await db.query.roles.findFirst({
            where: and(eq(roles.id, roleId), isNull(roles.deletedAt)),
            columns: { id: true, rules: true, hiddenModules: true },
        });
        if (!existing) {
            throw httpError.notFound(`Role "${roleId}" not found`);
        }

        const isAdmin = authHelper.isAdmin(profile);
        const userHiddenModules = authHelper.getHiddenModules(profile);

        let nextRules = rules;
        let nextHiddenModules = input.hiddenModules ?? (existing.hiddenModules ? JSON.parse(existing.hiddenModules) : []);
        
        if (!isAdmin && userHiddenModules.length > 0) {
            const checkHidden = (perms: string[]) => {
                for (const p of perms) {
                    const def = PERMISSION_CATALOG.find(c => c.key === p);
                    if (def && userHiddenModules.includes(def.module)) {
                        throw httpError.forbidden(`Bạn không có quyền quản lý nhóm quyền ${def.module}`);
                    }
                }
            };
            checkHidden(rules.permissions);
            checkHidden(rules.restrictions);

            const existingParsed = parseRoleRules(existing.rules);
            const preservedPermissions = existingParsed.permissions.filter(p => {
                const def = PERMISSION_CATALOG.find(c => c.key === p);
                return def ? userHiddenModules.includes(def.module) : false;
            });
            const preservedRestrictions = existingParsed.restrictions.filter(p => {
                const def = PERMISSION_CATALOG.find(c => c.key === p);
                return def ? userHiddenModules.includes(def.module) : false;
            });

            nextRules = {
                permissions: [...new Set([...rules.permissions, ...preservedPermissions])],
                restrictions: [...new Set([...rules.restrictions, ...preservedRestrictions])],
            };
        }

        const updateData: any = {
            rules: serializeRoleRules(nextRules),
            updatedAt: new Date(),
        };

        if (isAdmin && input.hiddenModules !== undefined) {
            updateData.hiddenModules = JSON.stringify(input.hiddenModules);
        }

        const [updated] = await db.update(roles)
            .set(updateData)
            .where(eq(roles.id, roleId))
            .returning();

        await ProfileService.clearProfileCacheForRole(roleId);

        return this.getPermissions(updated.id, profile);
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

        if (input.rules) {
            await ProfileService.clearProfileCacheForRole(roleId);
        }

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
