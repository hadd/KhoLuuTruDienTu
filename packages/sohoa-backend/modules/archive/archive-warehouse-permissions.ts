import { Permission } from "../auth/permission-catalog.ts";
import {
    userRolesHavePermission,
} from "../auth/permission-resolver.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";

/** Quyền kho trên Function Matrix + ACL (search gộp vào read). Không còn warehouse.manage. */
export const ARCHIVE_WAREHOUSE_ACL_PERMISSION_KEYS = [
    Permission.ARCHIVE_WAREHOUSE_READ,
    Permission.ARCHIVE_WAREHOUSE_EDIT,
    Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
    Permission.ARCHIVE_WAREHOUSE_DELETE,
    Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
] as const;

export type ArchiveWarehouseAclPermissionKey =
    (typeof ARCHIVE_WAREHOUSE_ACL_PERMISSION_KEYS)[number];

/** Quyền vào API / màn kho (xem+search / thao tác). */
export const ARCHIVE_WAREHOUSE_ACCESS_PERMISSIONS = [
    Permission.ARCHIVE_WAREHOUSE_READ,
    Permission.ARCHIVE_WAREHOUSE_SEARCH,
    Permission.ARCHIVE_WAREHOUSE_EDIT,
    Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
    Permission.ARCHIVE_WAREHOUSE_DELETE,
    Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
    Permission.SEARCH_GLOBAL,
] as const;

export function hasArchiveWarehousePermission(
    profile: UserWithRoles,
    permission: string,
): boolean {
    if (userRolesHavePermission(profile.userRoles, permission)) {
        return true;
    }
    // Xem → được tìm kiếm toàn văn.
    if (
        permission === Permission.ARCHIVE_WAREHOUSE_SEARCH &&
        userRolesHavePermission(profile.userRoles, Permission.ARCHIVE_WAREHOUSE_READ)
    ) {
        return true;
    }
    return false;
}

/** Permissions accepted for full-text warehouse search. */
export const ARCHIVE_WAREHOUSE_SEARCH_PERMISSIONS = [
    Permission.ARCHIVE_WAREHOUSE_READ,
    Permission.ARCHIVE_WAREHOUSE_SEARCH,
    Permission.SEARCH_GLOBAL,
] as const;

/** Quyền thao tác kho (ẩn/hiện nút FE). */
export const ARCHIVE_WAREHOUSE_ACTION_PERMISSIONS = [
    Permission.ARCHIVE_WAREHOUSE_EDIT,
    Permission.ARCHIVE_WAREHOUSE_CONFIGURE_SECURITY,
    Permission.ARCHIVE_WAREHOUSE_DELETE,
    Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
] as const;

/** Quyền tải xuống kho (download / download_watermark, gated by security-level). */
export const ARCHIVE_WAREHOUSE_DOWNLOAD_PERMISSIONS = [
    Permission.ARCHIVE_WAREHOUSE_DOWNLOAD_ORIGINAL,
    Permission.ARCHIVE_WAREHOUSE_DOWNLOAD_WATERMARK,
] as const;

export function hasArchiveWarehouseDownloadPermission(
    profile: UserWithRoles,
    permission: string,
): boolean {
    return userRolesHavePermission(profile.userRoles, permission);
}

export function canDownload(profile: UserWithRoles): boolean {
    return userRolesHavePermission(
        profile.userRoles,
        Permission.ARCHIVE_WAREHOUSE_DOWNLOAD_ORIGINAL, // deprecated role key, kept for legacy
    );
}

/** @deprecated Use canDownload. */
export const canDownloadOriginal = canDownload;

export function canDownloadWatermark(profile: UserWithRoles): boolean {
    return userRolesHavePermission(
        profile.userRoles,
        Permission.ARCHIVE_WAREHOUSE_DOWNLOAD_WATERMARK,
    );
}

export function canDownloadAny(profile: UserWithRoles): boolean {
    return canDownload(profile) || canDownloadWatermark(profile);
}
