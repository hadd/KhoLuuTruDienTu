import type { AppRoleT } from '@/features/auth/constants'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'
import {
  hasFullAccess,
  isPermissionGranted,
} from '@/features/permissions/lib/permissionRules'

export const DATA_ENTRY_MODULE = 'data-entry' as const
export const DATA_ENTRY_MAKER_PERMISSION = 'data-entry.maker' as const
export const DATA_ENTRY_CHECKER_PERMISSION = 'data-entry.checker' as const

export const DATA_ENTRY_SCREEN_REQUIREMENTS: Array<ScreenPermissionRequirement> =
  [
    { module: DATA_ENTRY_MODULE, permissionKey: DATA_ENTRY_MAKER_PERMISSION },
    { module: DATA_ENTRY_MODULE, permissionKey: DATA_ENTRY_CHECKER_PERMISSION },
  ]

export function hasDataEntryMakerPermission(
  permissions: Array<string>,
): boolean {
  return isPermissionGranted(
    permissions,
    DATA_ENTRY_MAKER_PERMISSION,
    DATA_ENTRY_MODULE,
  )
}

export function hasDataEntryCheckerPermission(
  permissions: Array<string>,
): boolean {
  return isPermissionGranted(
    permissions,
    DATA_ENTRY_CHECKER_PERMISSION,
    DATA_ENTRY_MODULE,
  )
}

/**
 * Resolve which data-management UI to show from permissions:
 * - Full access or both maker + checker → admin folder tree
 * - Maker only → editor view
 * - Checker only → QC view
 */
export function resolveDataManagementRole(
  permissions: Array<string>,
  _primaryAppRole?: AppRoleT | null,
): DataManagementRole {
  if (hasFullAccess(permissions)) {
    return 'admin'
  }

  const hasMaker = hasDataEntryMakerPermission(permissions)
  const hasChecker = hasDataEntryCheckerPermission(permissions)
  const hasDossiersRead = isPermissionGranted(permissions, 'dossiers.read', 'dossiers')
  const hasDossiersWrite = isPermissionGranted(permissions, 'dossiers.write', 'dossiers')

  if ((hasMaker && hasChecker) || hasDossiersRead || hasDossiersWrite) {
    return 'admin'
  }

  if (hasMaker) {
    return 'editor'
  }

  if (hasChecker) {
    return 'qc'
  }

  return 'editor'
}

/** `/app/data` — visible when user has biên tập, duyệt, quản lý hồ sơ, or full access */
export function canAccessDataManagementScreen(
  permissions: Array<string>,
  _primaryAppRole?: AppRoleT | null,
): boolean {
  return (
    hasFullAccess(permissions) ||
    hasDataEntryMakerPermission(permissions) ||
    hasDataEntryCheckerPermission(permissions) ||
    isPermissionGranted(permissions, 'dossiers.read', 'dossiers') ||
    isPermissionGranted(permissions, 'dossiers.write', 'dossiers')
  )
}

/**
 * `/app/dossiers` — only when the user has maker-only data-entry access
 * (editor workflow list, not admin/QC tree).
 */
export function canAccessDossierManagementScreen(
  permissions: Array<string>,
  _primaryAppRole?: AppRoleT | null,
): boolean {
  if (hasFullAccess(permissions)) {
    return false
  }

  const hasMaker = hasDataEntryMakerPermission(permissions)
  const hasChecker = hasDataEntryCheckerPermission(permissions)

  return hasMaker && !hasChecker
}
