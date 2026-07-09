import { hasFullAccess, isPermissionGranted } from '@/features/permissions/lib/permissionRules'

export const ARCHIVE_MODULE = 'archive'
export const ARCHIVE_SUBMIT_PERMISSION = 'archive.submit'
export const ARCHIVE_REVIEW_PERMISSION = 'archive.review'

export function canSubmitArchive(permissions: Array<string>): boolean {
  if (hasFullAccess(permissions)) return true
  return isPermissionGranted(
    permissions,
    ARCHIVE_SUBMIT_PERMISSION,
    ARCHIVE_MODULE,
  )
}

export function canReviewArchive(permissions: Array<string>): boolean {
  if (hasFullAccess(permissions)) return true
  return isPermissionGranted(
    permissions,
    ARCHIVE_REVIEW_PERMISSION,
    ARCHIVE_MODULE,
  )
}

export function canSubmitDossierToArchive(status?: string | null): boolean {
  return status === 'APPROVED' || status === 'ARCHIVE_REJECTED'
}
