import { Permission } from "../auth/permission-catalog.ts";
import { userRolesHavePermission } from "../auth/permission-resolver.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";

export const ARCHIVE_BORROW_REQUEST_PERMISSIONS = [
    Permission.ARCHIVE_BORROW_REQUEST,
] as const;

export const ARCHIVE_BORROW_REVIEW_PERMISSIONS = [
    Permission.ARCHIVE_BORROW_REVIEW,
] as const;

/** Reading / viewer access follows exploitation OR borrow-request. */
export const ARCHIVE_BORROW_READING_PERMISSIONS = [
    Permission.LIBRARY_EXPLOITATION_READ,
    Permission.ARCHIVE_BORROW_REQUEST,
] as const;

function hasAnyPermission(
    profile: UserWithRoles,
    keys: readonly string[],
): boolean {
    return keys.some((key) => userRolesHavePermission(profile.userRoles, key));
}

export function hasArchiveBorrowRequestPermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_BORROW_REQUEST_PERMISSIONS);
}

export function hasArchiveBorrowReviewPermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_BORROW_REVIEW_PERMISSIONS);
}

export function hasArchiveBorrowReadingPermission(profile: UserWithRoles): boolean {
    return hasAnyPermission(profile, ARCHIVE_BORROW_READING_PERMISSIONS);
}

export function hasAnyArchiveBorrowPermission(profile: UserWithRoles): boolean {
    return hasArchiveBorrowRequestPermission(profile) ||
        hasArchiveBorrowReviewPermission(profile);
}
