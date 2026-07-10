import { hasFullAccess, isPermissionGranted } from '@/features/permissions/lib/permissionRules'

export const ARCHIVE_MODULE = 'archive'
export const ARCHIVE_CONFIG_MANAGE_PERMISSION = 'archive.config.manage'

export function canManageArchiveConfig(permissions: Array<string>): boolean {
  if (hasFullAccess(permissions)) return true
  return isPermissionGranted(
    permissions,
    ARCHIVE_CONFIG_MANAGE_PERMISSION,
    ARCHIVE_MODULE,
  )
}
