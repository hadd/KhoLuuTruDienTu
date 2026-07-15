import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { db } from "../../db/db-conn.ts";
import {
    archiveAclEntries,
    archiveAclPrincipals,
    type ArchiveAclResourceKind,
} from "../../db/schemas/archive-acl.ts";
import { fonds } from "../../db/schemas/fond.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    parseRoleRules,
    userRolesHavePermission,
} from "../auth/permission-resolver.ts";
import {
    ARCHIVE_WAREHOUSE_ACL_PERMISSION_KEYS,
    hasArchiveWarehousePermission,
} from "../archive/archive-warehouse-permissions.ts";

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

const ACL_KEY_SET = new Set<string>([
    ...ARCHIVE_WAREHOUSE_ACL_PERMISSION_KEYS,
    Permission.ARCHIVE_WAREHOUSE_SEARCH,
]);

/** ACL row key matches the scope permission being resolved (search↔read). */
function aclKeyMatchesScope(rowKey: string, scopePermission: string): boolean {
    if (rowKey === scopePermission) return true;
    // Xem và tìm kiếm gộp — ACL xem hoặc search đều match cả hai.
    if (
        (scopePermission === Permission.ARCHIVE_WAREHOUSE_SEARCH ||
            scopePermission === Permission.ARCHIVE_WAREHOUSE_READ) &&
        (rowKey === Permission.ARCHIVE_WAREHOUSE_SEARCH ||
            rowKey === Permission.ARCHIVE_WAREHOUSE_READ)
    ) {
        return true;
    }
    return false;
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

        // Chỉ search.global bypass toàn kho.
        if (userRolesHavePermission(profile.userRoles, Permission.SEARCH_GLOBAL)) {
            return { mode: "global", permissions: collectRolePermissions(profile) };
        }

        if (!hasArchiveWarehousePermission(profile, scopePermission)) {
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

        const directFondIdSet = new Set<string>();
        const fondTypeSet = new Set<string>();
        const dossierTypeIdSet = new Set<string>();
        const documentTypeIdSet = new Set<string>();
        const permissionSet = new Set<string>();

        for (const row of rows) {
            if (!ACL_KEY_SET.has(row.permissionKey)) continue;

            // Capability trên Function Matrix (search ACL → cần read).
            const capabilityKey = row.permissionKey === Permission.ARCHIVE_WAREHOUSE_SEARCH
                ? Permission.ARCHIVE_WAREHOUSE_READ
                : row.permissionKey;
            if (!hasArchiveWarehousePermission(profile, capabilityKey) &&
                !hasArchiveWarehousePermission(profile, row.permissionKey)
            ) {
                continue;
            }

            permissionSet.add(row.permissionKey);

            if (!aclKeyMatchesScope(row.permissionKey, scopePermission)) {
                continue;
            }

            const kind = row.resourceKind as ArchiveAclResourceKind;
            if (kind === "fond") directFondIdSet.add(row.resourceId);
            else if (kind === "fond_type") fondTypeSet.add(row.resourceId);
            else if (kind === "dossier_type") dossierTypeIdSet.add(row.resourceId);
            else if (kind === "document_type") documentTypeIdSet.add(row.resourceId);
        }

        const fondIdSet = new Set(directFondIdSet);
        if (fondTypeSet.size > 0) {
            const typeFonds = await db.query.fonds.findMany({
                where: and(
                    isNull(fonds.deletedAt),
                    inArray(fonds.fondType, [...fondTypeSet]),
                ),
                columns: { id: true },
            });
            for (const fond of typeFonds) fondIdSet.add(fond.id);
        }

        if (fondIdSet.size === 0) {
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
