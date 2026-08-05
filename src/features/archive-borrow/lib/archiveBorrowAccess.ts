import { hasFullAccess, isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'
import { LIBRARY_EXPLOITATION_PERMISSIONS } from '@/features/library/lib/libraryExploitationAccess'

export const ARCHIVE_BORROW_MODULE = 'library'

export const ARCHIVE_BORROW_PERMISSIONS = {
  request: 'library.borrow.request',
  review: 'library.borrow.review',
} as const

export const ARCHIVE_BORROW_REQUEST_SCREEN_REQUIREMENTS = [
  {
    module: ARCHIVE_BORROW_MODULE,
    permissionKey: ARCHIVE_BORROW_PERMISSIONS.request,
  },
] as const satisfies Array<ScreenPermissionRequirement>

export const ARCHIVE_BORROW_REVIEW_SCREEN_REQUIREMENTS = [
  {
    module: ARCHIVE_BORROW_MODULE,
    permissionKey: ARCHIVE_BORROW_PERMISSIONS.review,
  },
] as const satisfies Array<ScreenPermissionRequirement>

/** Viewer / Đang đọc: exploitation read OR borrow request. */
export const ARCHIVE_BORROW_READING_SCREEN_REQUIREMENTS = [
  {
    module: ARCHIVE_BORROW_MODULE,
    permissionKey: LIBRARY_EXPLOITATION_PERMISSIONS.read,
  },
  {
    module: ARCHIVE_BORROW_MODULE,
    permissionKey: ARCHIVE_BORROW_PERMISSIONS.request,
  },
] as const satisfies Array<ScreenPermissionRequirement>

export const ARCHIVE_BORROW_SCREEN_REQUIREMENTS = [
  ...ARCHIVE_BORROW_REQUEST_SCREEN_REQUIREMENTS,
  ...ARCHIVE_BORROW_REVIEW_SCREEN_REQUIREMENTS,
] as const satisfies Array<ScreenPermissionRequirement>

export function hasArchiveBorrowRequestPermission(
  permissions: Array<string>,
): boolean {
  if (hasFullAccess(permissions)) return true
  return isPermissionGranted(
    permissions,
    ARCHIVE_BORROW_PERMISSIONS.request,
    ARCHIVE_BORROW_MODULE,
  )
}

export function hasArchiveBorrowReviewPermission(
  permissions: Array<string>,
): boolean {
  if (hasFullAccess(permissions)) return true
  return isPermissionGranted(
    permissions,
    ARCHIVE_BORROW_PERMISSIONS.review,
    ARCHIVE_BORROW_MODULE,
  )
}

export function hasArchiveBorrowReadingPermission(
  permissions: Array<string>,
): boolean {
  if (hasFullAccess(permissions)) return true
  return (
    isPermissionGranted(
      permissions,
      LIBRARY_EXPLOITATION_PERMISSIONS.read,
      ARCHIVE_BORROW_MODULE,
    ) ||
    isPermissionGranted(
      permissions,
      ARCHIVE_BORROW_PERMISSIONS.request,
      ARCHIVE_BORROW_MODULE,
    )
  )
}
