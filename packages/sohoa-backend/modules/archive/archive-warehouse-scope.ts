import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { ArchiveScopeResolver } from "../archive-permission/archive-scope-resolver.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { userRolesHavePermission } from "../auth/permission-resolver.ts";
import {
    ARCHIVE_WAREHOUSE_ACTION_PERMISSIONS,
    hasArchiveWarehousePermission,
} from "./archive-warehouse-permissions.ts";

export { ARCHIVE_WAREHOUSE_ACTION_PERMISSIONS };

export async function resolveWarehouseScope(profile: UserWithRoles) {
    const candidates = [
        Permission.ARCHIVE_WAREHOUSE_READ,
        Permission.ARCHIVE_WAREHOUSE_SEARCH,
        Permission.ARCHIVE_WAREHOUSE_EDIT,
        Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
        Permission.ARCHIVE_WAREHOUSE_DELETE,
        Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
        Permission.ARCHIVE_DISPOSAL_READ,
        Permission.ARCHIVE_DISPOSAL_CREATE,
        Permission.ARCHIVE_DISPOSAL_UPDATE,
        Permission.ARCHIVE_DISPOSAL_SUBMIT,
        Permission.ARCHIVE_DISPOSAL_MANAGE,
    ] as const;
    const warehousePermission = candidates.find((key) =>
        hasArchiveWarehousePermission(profile, key) ||
        userRolesHavePermission(profile.userRoles, key)
    ) ?? Permission.ARCHIVE_WAREHOUSE_READ;

    const scope = await ArchiveScopeResolver.resolve(profile, {
        warehousePermission,
        includeAllCapableResources: true,
    });
    return {
        scope,
        fondScope: scope.mode === "global"
            ? null
            : scope.mode === "scoped" || scope.mode === "fond"
            ? scope.fondIds
            : [],
    };
}

// Re-export for permission checks used alongside scope resolution.