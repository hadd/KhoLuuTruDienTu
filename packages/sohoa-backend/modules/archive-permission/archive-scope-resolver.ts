import { and, eq, inArray, or } from "drizzle-orm";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { db } from "../../db/db-conn.ts";
import {
    archiveAclEntries,
    archiveAclPrincipals,
    type ArchiveAclResourceKind,
} from "../../db/schemas/archive-acl.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    parseRoleRules,
    userRolesHavePermission,
} from "../auth/permission-resolver.ts";

export type ArchiveDataScope =
    | { mode: "global"; permissions: string[] }
    | {
        mode: "scoped";
        permissions: string[];
        fondIds: string[];
        dossierTypeIds: string[];
        documentTypeIds: string[];
    }
    /** @deprecated Prefer `scoped`. Kept for transitional callers. */
    | { mode: "fond"; fondIds: string[]; permissions: string[] }
    | { mode: "none" };

const WAREHOUSE_PERMISSION_KEYS = [
    Permission.ARCHIVE_WAREHOUSE_SEARCH,
    Permission.ARCHIVE_WAREHOUSE_READ,
    Permission.ARCHIVE_WAREHOUSE_MANAGE,
] as const;

function userHasPermission(profile: UserWithRoles, permission: string): boolean {
    return userRolesHavePermission(profile.userRoles, permission);
}

function collectRolePermissions(profile: UserWithRoles): string[] {
    const set = new Set<string>();
    for (const userRole of profile.userRoles) {
        const rules = parseRoleRules(userRole.role.rules);
        for (const key of rules.permissions) set.add(key);
    }
    return [...set];
}

function roleIdsOf(profile: UserWithRoles): string[] {
    return profile.userRoles.map((ur) => ur.role.id);
}

export type ResolveArchiveScopeOptions = {
    warehousePermission?: string;
};

export const ArchiveScopeResolver = {
    async resolve(
        profile: UserWithRoles,
        options?: ResolveArchiveScopeOptions,
    ): Promise<ArchiveDataScope> {
        const scopePermission = options?.warehousePermission
            ?? Permission.ARCHIVE_WAREHOUSE_SEARCH;

        if (
            userHasPermission(profile, Permission.SEARCH_GLOBAL)
            || userHasPermission(profile, Permission.ARCHIVE_WAREHOUSE_MANAGE)
        ) {
            return { mode: "global", permissions: collectRolePermissions(profile) };
        }

        if (!userHasPermission(profile, scopePermission)) {
            return { mode: "none" };
        }

        const roleIds = roleIdsOf(profile);
        const principalFilters = [
            and(
                eq(archiveAclPrincipals.principalKind, "user"),
                eq(archiveAclPrincipals.principalId, profile.id),
            ),
            ...(roleIds.length > 0
                ? [
                    and(
                        eq(archiveAclPrincipals.principalKind, "role"),
                        inArray(archiveAclPrincipals.principalId, roleIds),
                    ),
                ]
                : []),
        ];

        const rows = await db
            .select({
                resourceKind: archiveAclEntries.resourceKind,
                resourceId: archiveAclEntries.resourceId,
                permissionKey: archiveAclEntries.permissionKey,
            })
            .from(archiveAclPrincipals)
            .innerJoin(
                archiveAclEntries,
                eq(archiveAclPrincipals.entryId, archiveAclEntries.id),
            )
            .where(or(...principalFilters));

        const fondIdSet = new Set<string>();
        const dossierTypeIdSet = new Set<string>();
        const documentTypeIdSet = new Set<string>();
        const permissionSet = new Set<string>();

        for (const row of rows) {
            if (!WAREHOUSE_PERMISSION_KEYS.includes(row.permissionKey as typeof WAREHOUSE_PERMISSION_KEYS[number])) {
                continue;
            }
            if (!userHasPermission(profile, row.permissionKey)) {
                continue;
            }
            permissionSet.add(row.permissionKey);

            if (row.permissionKey !== scopePermission) {
                continue;
            }

            const kind = row.resourceKind as ArchiveAclResourceKind;
            if (kind === "fond") fondIdSet.add(row.resourceId);
            else if (kind === "dossier_type") dossierTypeIdSet.add(row.resourceId);
            else if (kind === "document_type") documentTypeIdSet.add(row.resourceId);
        }

        // Scoped access requires both fond and dossier-type grants for the permission.
        if (fondIdSet.size === 0 || dossierTypeIdSet.size === 0) {
            return { mode: "none" };
        }

        return {
            mode: "scoped",
            fondIds: [...fondIdSet],
            dossierTypeIds: [...dossierTypeIdSet],
            documentTypeIds: [...documentTypeIdSet],
            permissions: [...permissionSet],
        };
    },
};
