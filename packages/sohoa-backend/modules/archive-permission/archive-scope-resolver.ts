import { and, eq, isNull } from "drizzle-orm";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { db } from "../../db/db-conn.ts";
import { archiveGroupBindings } from "../../db/schemas/archive-group-binding.ts";
import { archiveUserAssignments } from "../../db/schemas/archive-user-assignment.ts";
import { groupMembers } from "../../db/schemas/group_members.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    parseRoleRules,
    userRolesHavePermission,
} from "../auth/permission-resolver.ts";

export type ArchiveDataScope =
    | { mode: "global"; permissions: string[] }
    | { mode: "fond"; fondIds: string[]; permissions: string[] }
    | { mode: "none" };

function userHasPermission(profile: UserWithRoles, permission: string): boolean {
    return userRolesHavePermission(profile.userRoles, permission);
}

function slotAllowsPermission(
    profile: UserWithRoles,
    slotPermissionKeys: string[],
    permission: string,
): boolean {
    if (!slotPermissionKeys.includes(permission)) return false;
    return userHasPermission(profile, permission);
}

function collectRolePermissions(profile: UserWithRoles): string[] {
    const set = new Set<string>();
    for (const userRole of profile.userRoles) {
        const rules = parseRoleRules(userRole.role.rules);
        for (const key of rules.permissions) set.add(key);
    }
    return [...set];
}

export const ArchiveScopeResolver = {
    async resolve(profile: UserWithRoles): Promise<ArchiveDataScope> {
        if (
            userHasPermission(profile, Permission.SEARCH_GLOBAL)
            || userHasPermission(profile, Permission.ARCHIVE_WAREHOUSE_MANAGE)
        ) {
            return { mode: "global", permissions: collectRolePermissions(profile) };
        }

        if (!userHasPermission(profile, Permission.ARCHIVE_WAREHOUSE_SEARCH)) {
            return { mode: "none" };
        }

        const fondIdSet = new Set<string>();
        const permissionSet = new Set<string>();

        const userAssignments = await db.query.archiveUserAssignments.findMany({
            where: eq(archiveUserAssignments.userId, profile.id),
            with: {
                config: {
                    with: {
                        slots: true,
                    },
                },
            },
        });

        for (const assignment of userAssignments) {
            const slot = assignment.config?.slots?.find(
                (s) => s.slotCode === assignment.slotCode,
            );
            if (!slot) continue;

            const effectiveFondIds = assignment.fondIds.length > 0
                ? assignment.fondIds
                : slot.fondIds;

            for (const key of slot.permissionKeys) {
                if (slotAllowsPermission(profile, slot.permissionKeys, key)) {
                    permissionSet.add(key);
                }
            }

            if (
                slotAllowsPermission(
                    profile,
                    slot.permissionKeys,
                    Permission.ARCHIVE_WAREHOUSE_SEARCH,
                )
            ) {
                for (const fondId of effectiveFondIds) fondIdSet.add(fondId);
            }
        }

        const memberships = await db.query.groupMembers.findMany({
            where: and(
                eq(groupMembers.userId, profile.id),
                isNull(groupMembers.expiredAt),
            ),
        });

        for (const membership of memberships) {
            if (!membership.archivePermissionSlotCode) continue;

            const binding = await db.query.archiveGroupBindings.findFirst({
                where: eq(archiveGroupBindings.groupId, membership.groupId),
                with: {
                    config: {
                        with: {
                            slots: true,
                        },
                    },
                },
            });
            if (!binding?.config) continue;

            const slot = binding.config.slots.find(
                (s) => s.slotCode === membership.archivePermissionSlotCode,
            );
            if (!slot) continue;

            const effectiveFondIds = binding.fondIds.length > 0
                ? binding.fondIds
                : slot.fondIds;

            for (const key of slot.permissionKeys) {
                if (slotAllowsPermission(profile, slot.permissionKeys, key)) {
                    permissionSet.add(key);
                }
            }

            if (
                slotAllowsPermission(
                    profile,
                    slot.permissionKeys,
                    Permission.ARCHIVE_WAREHOUSE_SEARCH,
                )
            ) {
                for (const fondId of effectiveFondIds) fondIdSet.add(fondId);
            }
        }

        if (fondIdSet.size === 0) {
            return { mode: "none" };
        }

        return {
            mode: "fond",
            fondIds: [...fondIdSet],
            permissions: [...permissionSet],
        };
    },
};
