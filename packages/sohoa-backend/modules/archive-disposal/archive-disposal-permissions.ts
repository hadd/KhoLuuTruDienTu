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

export const ARCHIVE_DISPOSAL_COUNCIL_READ_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_COUNCIL_READ,
] as const;

export const ARCHIVE_DISPOSAL_COUNCIL_CREATE_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_COUNCIL_CREATE,
] as const;

export const ARCHIVE_DISPOSAL_COUNCIL_UPDATE_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_COUNCIL_UPDATE,
] as const;

export const ARCHIVE_DISPOSAL_COUNCIL_FINALIZE_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_COUNCIL_FINALIZE,
] as const;

export const ARCHIVE_DISPOSAL_COUNCIL_PUBLISH_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_COUNCIL_PUBLISH,
] as const;

export const ARCHIVE_DISPOSAL_COUNCIL_CHAIR_DECIDE_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_COUNCIL_CHAIR_DECIDE,
] as const;

export const ARCHIVE_DISPOSAL_SETTINGS_READ_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_SETTINGS_READ,
    Permission.ARCHIVE_DISPOSAL_READ,
    Permission.ARCHIVE_DISPOSAL_COUNCIL_READ,
    Permission.ARCHIVE_WAREHOUSE_READ,
] as const;

export const ARCHIVE_DISPOSAL_SETTINGS_UPDATE_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_SETTINGS_UPDATE,
] as const;

export const ARCHIVE_DISPOSAL_DESTROY_PERMISSIONS = [
    Permission.ARCHIVE_DISPOSAL_DESTROY,
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

export function hasArchiveDisposalCouncilReadPermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_COUNCIL_READ_PERMISSIONS);
}

export function hasArchiveDisposalCouncilCreatePermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_COUNCIL_CREATE_PERMISSIONS);
}

export function hasArchiveDisposalCouncilUpdatePermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_COUNCIL_UPDATE_PERMISSIONS);
}

export function hasArchiveDisposalCouncilFinalizePermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_COUNCIL_FINALIZE_PERMISSIONS);
}

export function hasArchiveDisposalCouncilPublishPermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_COUNCIL_PUBLISH_PERMISSIONS);
}

export function hasArchiveDisposalCouncilChairDecidePermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_COUNCIL_CHAIR_DECIDE_PERMISSIONS);
}

export function hasArchiveDisposalSettingsReadPermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_SETTINGS_READ_PERMISSIONS);
}

export function hasArchiveDisposalSettingsUpdatePermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_SETTINGS_UPDATE_PERMISSIONS);
}

export function hasArchiveDisposalDestroyPermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_DISPOSAL_DESTROY_PERMISSIONS);
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

export function assertArchiveDisposalCouncilRead(profile: UserWithRoles): void {
    if (!hasArchiveDisposalCouncilReadPermission(profile)) {
        throw new Error("archive.disposal.council.read required");
    }
}

export function assertArchiveDisposalCouncilCreate(profile: UserWithRoles): void {
    if (!hasArchiveDisposalCouncilCreatePermission(profile)) {
        throw new Error("archive.disposal.council.create required");
    }
}

export function assertArchiveDisposalCouncilUpdate(profile: UserWithRoles): void {
    if (!hasArchiveDisposalCouncilUpdatePermission(profile)) {
        throw new Error("archive.disposal.council.update required");
    }
}

export function assertArchiveDisposalCouncilFinalize(profile: UserWithRoles): void {
    if (!hasArchiveDisposalCouncilFinalizePermission(profile)) {
        throw new Error("archive.disposal.council.finalize required");
    }
}

export function assertArchiveDisposalCouncilPublish(profile: UserWithRoles): void {
    if (!hasArchiveDisposalCouncilPublishPermission(profile)) {
        throw new Error("archive.disposal.council.publish required");
    }
}

export function assertArchiveDisposalCouncilChairDecide(profile: UserWithRoles): void {
    if (!hasArchiveDisposalCouncilChairDecidePermission(profile)) {
        throw new Error("archive.disposal.council.chair_decide required");
    }
}

export function assertArchiveDisposalSettingsRead(profile: UserWithRoles): void {
    if (!hasArchiveDisposalSettingsReadPermission(profile)) {
        throw new Error("archive.disposal.settings.read required");
    }
}

export function assertArchiveDisposalSettingsUpdate(profile: UserWithRoles): void {
    if (!hasArchiveDisposalSettingsUpdatePermission(profile)) {
        throw new Error("archive.disposal.settings.update required");
    }
}

export function assertArchiveDisposalDestroy(profile: UserWithRoles): void {
    if (!hasArchiveDisposalDestroyPermission(profile)) {
        throw new Error("archive.disposal.destroy required");
    }
}

/** @deprecated Use assertArchiveDisposalCreate/Update/Submit. */
export function assertArchiveDisposalManage(profile: UserWithRoles): void {
    if (!hasArchiveDisposalManagePermission(profile)) {
        throw new Error("archive.disposal.manage required");
    }
}
