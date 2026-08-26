import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'
import {
  hasFullAccess,
  isPermissionGranted,
} from '@/features/permissions/lib/permissionRules'

export const DASHBOARD_PERMISSION_KEYS = {
  editor: 'dashboard.editor',
  qc: 'dashboard.qc',
  admin: 'dashboard.admin',
  warehouse: 'dashboard.warehouse',
} as const

export type DashboardVariantT = keyof typeof DASHBOARD_PERMISSION_KEYS

export const DASHBOARD_SCREEN_REQUIREMENTS = [
  {
    module: 'dashboard',
    permissionKey: DASHBOARD_PERMISSION_KEYS.editor,
  },
  {
    module: 'dashboard',
    permissionKey: DASHBOARD_PERMISSION_KEYS.qc,
  },
  {
    module: 'dashboard',
    permissionKey: DASHBOARD_PERMISSION_KEYS.admin,
  },
  {
    module: 'dashboard',
    permissionKey: DASHBOARD_PERMISSION_KEYS.warehouse,
  },
  {
    module: 'data-entry',
    permissionKey: 'data-entry.maker',
  },
  {
    module: 'data-entry',
    permissionKey: 'data-entry.checker',
  },
] as const satisfies ReadonlyArray<ScreenPermissionRequirement>


export function canAccessAnyDashboard(permissions: Array<string>): boolean {
  if (hasFullAccess(permissions)) {
    return true
  }

  return DASHBOARD_SCREEN_REQUIREMENTS.some((requirement) =>
    isPermissionGranted(
      permissions,
      requirement.permissionKey,
      requirement.module,
    ),
  )
}

export function resolveDashboardVariant(
  permissions: Array<string>,
): DashboardVariantT | null {
  if (
    hasFullAccess(permissions) ||
    permissions.includes(DASHBOARD_PERMISSION_KEYS.admin)
  ) {
    return 'admin'
  }

  if (
    isPermissionGranted(
      permissions,
      DASHBOARD_PERMISSION_KEYS.qc,
      'dashboard',
    ) ||
    isPermissionGranted(permissions, 'data-entry.checker', 'data-entry')
  ) {
    return 'qc'
  }

  if (
    isPermissionGranted(
      permissions,
      DASHBOARD_PERMISSION_KEYS.editor,
      'dashboard',
    ) ||
    isPermissionGranted(permissions, 'data-entry.maker', 'data-entry')
  ) {
    return 'editor'
  }

  if (
    isPermissionGranted(
      permissions,
      DASHBOARD_PERMISSION_KEYS.warehouse,
      'dashboard',
    )
  ) {
    return 'warehouse'
  }

  if (
    isPermissionGranted(
      permissions,
      DASHBOARD_PERMISSION_KEYS.admin,
      'dashboard',
    )
  ) {
    return 'admin'
  }

  return null
}
