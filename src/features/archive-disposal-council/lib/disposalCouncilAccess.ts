import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

const MODULE = 'archive.disposal'

export const DISPOSAL_COUNCIL_PERMISSIONS = {
  councilRead: 'archive.disposal.council.read',
  councilCreate: 'archive.disposal.council.create',
  councilUpdate: 'archive.disposal.council.update',
  settingsRead: 'archive.disposal.settings.read',
  settingsUpdate: 'archive.disposal.settings.update',
  destroy: 'archive.disposal.destroy',
} as const

function hasPermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
  permissionKey: string,
): boolean {
  return isPermissionGranted(permissions, permissionKey, MODULE)
}

export function hasDisposalCouncilReadPermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
): boolean {
  return hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.councilRead)
}

export function hasDisposalCouncilCreatePermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
): boolean {
  return hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.councilCreate)
}

export function hasDisposalCouncilUpdatePermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
): boolean {
  return hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.councilUpdate)
}

export function hasDisposalSettingsReadPermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
): boolean {
  return hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.settingsRead)
}

export function hasDisposalSettingsUpdatePermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
): boolean {
  return hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.settingsUpdate)
}

export function hasDisposalDestroyPermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
): boolean {
  return hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.destroy)
}
