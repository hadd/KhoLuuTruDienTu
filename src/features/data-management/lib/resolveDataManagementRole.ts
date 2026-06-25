import type { AppRoleT } from '@/features/auth/constants'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import {
  hasFullAccess,
  isPermissionGranted,
} from '@/features/permissions/lib/permissionRules'

export const DATA_ENTRY_MODULE = 'data-entry' as const
export const DATA_ENTRY_MAKER_PERMISSION = 'data-entry.maker' as const
export const DATA_ENTRY_CHECKER_PERMISSION = 'data-entry.checker' as const

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
 * - Both maker + checker → admin folder tree
 * - Maker only → editor view
 * - Checker only → QC view
 */
export function resolveDataManagementRole(
  permissions: Array<string>,
  primaryAppRole?: AppRoleT | null,
): DataManagementRole {
  if (primaryAppRole === 'admin' || primaryAppRole === 'manager') {
    return primaryAppRole
  }

  if (hasFullAccess(permissions)) {
    return 'admin'
  }

  const hasMaker = hasDataEntryMakerPermission(permissions)
  const hasChecker = hasDataEntryCheckerPermission(permissions)

  if (hasMaker && hasChecker) {
    return 'admin'
  }

  if (hasMaker) {
    return 'editor'
  }

  if (hasChecker) {
    return 'qc'
  }

  if (primaryAppRole === 'qc' || primaryAppRole === 'editor') {
    return primaryAppRole
  }

  return 'editor'
}
