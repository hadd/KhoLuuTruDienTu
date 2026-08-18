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
  if (hasFullAccess(permissions)) {
    return 'admin'
  }

  if (isPermissionGranted(permissions, 'dashboard.*', 'dashboard')) {
    return 'admin'
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

  if (
    isPermissionGranted(permissions, DASHBOARD_PERMISSION_KEYS.qc, 'dashboard')
  ) {
    return 'qc'
  }

  if (
    isPermissionGranted(
      permissions,
      DASHBOARD_PERMISSION_KEYS.editor,
      'dashboard',
    )
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

  return null
}
