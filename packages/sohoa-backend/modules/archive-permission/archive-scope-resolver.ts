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
    ARCHIVE_WAREHOUSE_ACCESS_PERMISSIONS,
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

const ACL_OPS_KEYS = new Set<string>([
    Permission.ARCHIVE_WAREHOUSE_EDIT,
    Permission.ARCHIVE_WAREHOUSE_DELETE,
    Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
]);

const WAREHOUSE_CAPABILITY_KEYS = [
    Permission.ARCHIVE_WAREHOUSE_READ,
    Permission.ARCHIVE_WAREHOUSE_SEARCH,
    Permission.ARCHIVE_WAREHOUSE_EDIT,
    Permission.ARCHIVE_WAREHOUSE_DELETE,
    Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
] as const;

/** ACL row key matches the scope permission being resolved (search↔read; ops ⇄ read). */
export function aclKeyMatchesScope(rowKey: string, scopePermission: string): boolean {
    if (rowKey === scopePermission) return true;
    const isReadScope =
        scopePermission === Permission.ARCHIVE_WAREHOUSE_SEARCH ||
        scopePermission === Permission.ARCHIVE_WAREHOUSE_READ;
    const isReadKey =
        rowKey === Permission.ARCHIVE_WAREHOUSE_SEARCH ||
        rowKey === Permission.ARCHIVE_WAREHOUSE_READ;
    // Xem và tìm kiếm gộp — ACL xem hoặc search đều match cả hai.
    if (isReadScope && isReadKey) return true;
    // ACL thao tác (edit/delete/reupload) cũng mở phạm vi xem / list.
    if (isReadScope && ACL_OPS_KEYS.has(rowKey)) return true;
    // Matrix có ops nhưng ACL row là read/search.
    if (isReadKey && ACL_OPS_KEYS.has(scopePermission)) return true;
    return false;
}

/** Function Matrix capability covers this ACL row (bidirectional read↔ops). */
export function hasCapabilityForAclRow(
    profile: UserWithRoles,
    rowKey: string,
): boolean {
    return WAREHOUSE_CAPABILITY_KEYS.some((capability) =>
        hasArchiveWarehousePermission(profile, capability) &&
        aclKeyMatchesScope(rowKey, capability)
    );
}

export type PrincipalWarehouseGrant = {
    fondIds: string[];
    dossierTypeIds: string[];
    documentTypeIds: string[];
};

/**
 * Merge per-principal warehouse grants:
 * - fond-only principal → all children inside fond (no child filter bleed)
 * - fond + child on same principal → restrict inside fond
 * - child-only principal → browse-by-type
 */
export function mergePrincipalWarehouseGrants(
    grants: PrincipalWarehouseGrant[],
): Pick<PrincipalWarehouseGrant, "fondIds" | "dossierTypeIds" | "documentTypeIds"> {
    const fondIdSet = new Set<string>();
    const restrictedDossierTypeIds = new Set<string>();
    const restrictedDocumentTypeIds = new Set<string>();
    const childOnlyDossierTypeIds = new Set<string>();
    const childOnlyDocumentTypeIds = new Set<string>();
    let hasUnrestrictedFondPrincipal = false;

    for (const grant of grants) {
        const fondIds = grant.fondIds.filter(Boolean);
        const dossierTypeIds = grant.dossierTypeIds.filter(Boolean);
        const documentTypeIds = grant.documentTypeIds.filter(Boolean);
        const hasFond = fondIds.length > 0;
        const hasChild = dossierTypeIds.length > 0 || documentTypeIds.length > 0;

        for (const fondId of fondIds) fondIdSet.add(fondId);

        if (hasFond && !hasChild) {
            hasUnrestrictedFondPrincipal = true;
            continue;
        }

        if (hasFond && hasChild) {
            for (const id of dossierTypeIds) restrictedDossierTypeIds.add(id);
            for (const id of documentTypeIds) restrictedDocumentTypeIds.add(id);
            continue;
        }

        if (!hasFond && hasChild) {
            for (const id of dossierTypeIds) childOnlyDossierTypeIds.add(id);
            for (const id of documentTypeIds) childOnlyDocumentTypeIds.add(id);
        }
    }

    if (fondIdSet.size === 0) {
        return {
            fondIds: [],
            dossierTypeIds: [...childOnlyDossierTypeIds],
            documentTypeIds: [...childOnlyDocumentTypeIds],
        };
    }

    if (hasUnrestrictedFondPrincipal) {
        return {
            fondIds: [...fondIdSet],
            dossierTypeIds: [],
            documentTypeIds: [],
        };
    }

    return {
        fondIds: [...fondIdSet],
        dossierTypeIds: [...restrictedDossierTypeIds],
        documentTypeIds: [...restrictedDocumentTypeIds],
    };
}

type PrincipalGrantAccumulator = {
    directFondIds: Set<string>;
    fondTypes: Set<string>;
    dossierTypeIds: Set<string>;
    documentTypeIds: Set<string>;
};

function principalKey(kind: string, id: string): string {
    return `${kind}:${id}`;
}

function getOrCreatePrincipalGrant(
    map: Map<string, PrincipalGrantAccumulator>,
    key: string,
): PrincipalGrantAccumulator {
    const existing = map.get(key);
    if (existing) return existing;
    const created: PrincipalGrantAccumulator = {
        directFondIds: new Set(),
        fondTypes: new Set(),
        dossierTypeIds: new Set(),
        documentTypeIds: new Set(),
    };
    map.set(key, created);
    return created;
}

async function resolveFondIdsByType(
    fondTypes: Set<string>,
): Promise<Map<string, string[]>> {
    const fondTypeToIds = new Map<string, string[]>();
    if (fondTypes.size === 0) return fondTypeToIds;

    const typeFonds = await db.query.fonds.findMany({
        where: and(
            isNull(fonds.deletedAt),
            inArray(fonds.fondType, [...fondTypes]),
        ),
        columns: { id: true, fondType: true },
    });

    for (const fond of typeFonds) {
        const type = fond.fondType.trim();
        const list = fondTypeToIds.get(type) ?? [];
        list.push(fond.id);
        fondTypeToIds.set(type, list);
    }

    return fondTypeToIds;
}

function resolvePrincipalFondIds(
    state: PrincipalGrantAccumulator,
    fondTypeToIds: Map<string, string[]>,
): string[] {
    const ids = new Set(state.directFondIds);
    for (const fondType of state.fondTypes) {
        for (const fondId of fondTypeToIds.get(fondType) ?? []) {
            ids.add(fondId);
        }
    }
    return [...ids];
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

function hasAnyWarehouseAccess(profile: UserWithRoles): boolean {
    return ARCHIVE_WAREHOUSE_ACCESS_PERMISSIONS.some((key) =>
        hasArchiveWarehousePermission(profile, key)
    ) ||
        userRolesHavePermission(profile.userRoles, Permission.ARCHIVE_DISPOSAL_READ) ||
        userRolesHavePermission(profile.userRoles, Permission.ARCHIVE_DISPOSAL_CREATE) ||
        userRolesHavePermission(profile.userRoles, Permission.ARCHIVE_DISPOSAL_UPDATE) ||
        userRolesHavePermission(profile.userRoles, Permission.ARCHIVE_DISPOSAL_SUBMIT) ||
        userRolesHavePermission(profile.userRoles, Permission.ARCHIVE_DISPOSAL_MANAGE);
}

export type ResolveArchiveScopeOptions = {
    warehousePermission?: string;
    /**
     * List/browse: lấy union mọi resource ACL mà user có capability,
     * không bó vào một permission_key duy nhất.
     */
    includeAllCapableResources?: boolean;
};

export const ArchiveScopeResolver = {
    async resolve(
        profile: UserWithRoles,
        options?: ResolveArchiveScopeOptions,
    ): Promise<ArchiveDataScope> {
        const scopePermission = options?.warehousePermission
            ?? Permission.ARCHIVE_WAREHOUSE_SEARCH;
        const includeAllCapableResources = options?.includeAllCapableResources === true;

        // Chỉ search.global bypass toàn kho.
        if (userRolesHavePermission(profile.userRoles, Permission.SEARCH_GLOBAL)) {
            return { mode: "global", permissions: collectRolePermissions(profile) };
        }

        const canAccess = includeAllCapableResources
            ? hasAnyWarehouseAccess(profile)
            : hasArchiveWarehousePermission(profile, scopePermission);
        if (!canAccess) {
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
                principalKind: archiveAclPrincipals.principalKind,
                principalId: archiveAclPrincipals.principalId,
            })
            .from(archiveAclPrincipals)
            .innerJoin(
                archiveAclEntries,
                eq(archiveAclPrincipals.entryId, archiveAclEntries.id),
            )
            .where(or(...principalFilters));

        const principalGrantMap = new Map<string, PrincipalGrantAccumulator>();
        const permissionSet = new Set<string>();
        const allFondTypes = new Set<string>();

        for (const row of rows) {
            if (!ACL_KEY_SET.has(row.permissionKey)) continue;
            if (!hasCapabilityForAclRow(profile, row.permissionKey)) continue;

            permissionSet.add(row.permissionKey);

            if (
                !includeAllCapableResources &&
                !aclKeyMatchesScope(row.permissionKey, scopePermission)
            ) {
                continue;
            }

            const key = principalKey(row.principalKind, row.principalId);
            const grant = getOrCreatePrincipalGrant(principalGrantMap, key);
            const kind = row.resourceKind as ArchiveAclResourceKind;

            if (kind === "fond") grant.directFondIds.add(row.resourceId);
            else if (kind === "fond_type") {
                grant.fondTypes.add(row.resourceId);
                allFondTypes.add(row.resourceId);
            } else if (kind === "dossier_type") grant.dossierTypeIds.add(row.resourceId);
            else if (kind === "document_type") grant.documentTypeIds.add(row.resourceId);
        }

        const fondTypeToIds = await resolveFondIdsByType(allFondTypes);
        const principalGrants: PrincipalWarehouseGrant[] = [];

        for (const state of principalGrantMap.values()) {
            principalGrants.push({
                fondIds: resolvePrincipalFondIds(state, fondTypeToIds),
                dossierTypeIds: [...state.dossierTypeIds],
                documentTypeIds: [...state.documentTypeIds],
            });
        }

        const merged = mergePrincipalWarehouseGrants(principalGrants);

        return {
            mode: "scoped",
            fondIds: merged.fondIds,
            dossierTypeIds: merged.dossierTypeIds,
            documentTypeIds: merged.documentTypeIds,
            permissions: [...permissionSet],
        };
    },
};
