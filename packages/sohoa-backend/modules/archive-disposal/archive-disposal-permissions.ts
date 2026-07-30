import { Permission } from "../auth/permission-catalog.ts";
import { userRolesHavePermission } from "../auth/permission-resolver.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";

/** Legacy — mapped to create/update/submit in role migration. */
const LEGACY_ARCHIVE_DISPOSAL_MANAGE = Permission.ARCHIVE_DISPOSAL_MANAGE;

export const ARCHIVE_DISPOSAL_READ_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_READ,
    Permission.ARCHIVE_WAREHOUSE_READ,
] as const;

export const ARCHIVE_DISPOSAL_CREATE_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_CREATE,
    LEGACY_ARCHIVE_DISPOSAL_MANAGE,
] as const;

export const ARCHIVE_DISPOSAL_UPDATE_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_UPDATE,
    LEGACY_ARCHIVE_DISPOSAL_MANAGE,
] as const;

export const ARCHIVE_DISPOSAL_SUBMIT_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_SUBMIT,
    LEGACY_ARCHIVE_DISPOSAL_MANAGE,
] as const;

export const ARCHIVE_DISPOSAL_WRITE_PERMISSIONS = [
    ...ARCHIVE_DISPOSAL_CREATE_PERMISSIONS,
    ...ARCHIVE_DISPOSAL_UPDATE_PERMISSIONS,
    ...ARCHIVE_DISPOSAL_SUBMIT_PERMISSIONS,
] as const;

function hasAnyPermission(
    profile: UserWithRoles,
    keys: readonly string[],
): boolean {
    return keys.some((key) => userRolesHavePermission(profile.userRoles, key));
}

export function hasArchiveDisposalReadPermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_READ_PERMISSIONS);
}

export function hasArchiveDisposalCreatePermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_CREATE_PERMISSIONS);
}

export function hasArchiveDisposalUpdatePermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_UPDATE_PERMISSIONS);
}

export function hasArchiveDisposalSubmitPermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_SUBMIT_PERMISSIONS);
}

/** Any write capability (create, update, or submit). */
export function hasArchiveDisposalManagePermission(profile: UserWithRoles): boolean {
    return hasArchiveDisposalCreatePermission(profile) ||
        hasArchiveDisposalUpdatePermission(profile) ||
        hasArchiveDisposalSubmitPermission(profile);
}

export function assertArchiveDisposalRead(profile: UserWithRoles): void {
    if (!hasArchiveDisposalReadPermission(profile)) {
        throw new Error("archive.disposal.read required");
    }
}

export function assertArchiveDisposalCreate(profile: UserWithRoles): void {
    if (!hasArchiveDisposalCreatePermission(profile)) {
        throw new Error("archive.disposal.create required");
    }
}

export function assertArchiveDisposalUpdate(profile: UserWithRoles): void {
    if (!hasArchiveDisposalUpdatePermission(profile)) {
        throw new Error("archive.disposal.update required");
    }
}

export function assertArchiveDisposalSubmit(profile: UserWithRoles): void {
    if (!hasArchiveDisposalSubmitPermission(profile)) {
        throw new Error("archive.disposal.submit required");
    }
}

/** @deprecated Use assertArchiveDisposalCreate/Update/Submit. */
export function assertArchiveDisposalManage(profile: UserWithRoles): void {
    if (!hasArchiveDisposalManagePermission(profile)) {
        throw new Error("archive.disposal.manage required");
    }
}
