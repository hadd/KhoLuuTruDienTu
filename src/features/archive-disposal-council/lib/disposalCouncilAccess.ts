import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

const MODULE = 'archive.disposal'

export const DISPOSAL_COUNCIL_PERMISSIONS = {
  councilRead: 'archive.disposal.council.read',
  councilCreate: 'archive.disposal.council.create',
  councilUpdate: 'archive.disposal.council.update',
  councilFinalize: 'archive.disposal.council.finalize',
  councilPublish: 'archive.disposal.council.publish',
  councilChairDecide: 'archive.disposal.council.chair_decide',
  settingsManage: 'archive.disposal.settings.manage',
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

export function hasDisposalCouncilFinalizePermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
): boolean {
  return hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.councilFinalize)
}

export function hasDisposalCouncilPublishPermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
): boolean {
  return hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.councilPublish)
}

export function hasDisposalCouncilChairDecidePermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
): boolean {
  return hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.councilChairDecide)
}

export function hasDisposalSettingsUIManagePermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
): boolean {
  return hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.settingsManage)
}

export function hasDisposalSettingsManagePermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
): boolean {
  return (
    hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.settingsManage) ||
    hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.councilRead) ||
    isPermissionGranted(permissions, 'archive.disposal.read', 'archive.disposal') ||
    isPermissionGranted(permissions, 'archive.warehouse.read', 'archive.warehouse')
  )
}

export function hasDisposalDestroyPermission(
  permissions: Parameters<typeof isPermissionGranted>[0],
): boolean {
  return hasPermission(permissions, DISPOSAL_COUNCIL_PERMISSIONS.destroy)
}
