import { hasFullAccess, isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export const ARCHIVE_BORROW_MODULE = 'archive.borrow'

export const ARCHIVE_BORROW_PERMISSIONS = {
  request: 'archive.borrow.request',
  review: 'archive.borrow.review',
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
