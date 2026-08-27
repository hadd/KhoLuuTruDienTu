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

export const DASHBOARD_ADMIN_SUB_PERMISSIONS = {
  summary: 'dashboard.admin.summary',
  dossierStatusChart: 'dashboard.admin.dossier_status_chart',
  projectStatusChart: 'dashboard.admin.project_status_chart',
  dossierTrendChart: 'dashboard.admin.dossier_trend_chart',
  systemPerformance: 'dashboard.admin.system_performance',
  employeeKpis: 'dashboard.admin.employee_kpis',
  groupPerformanceChart: 'dashboard.admin.group_performance_chart',
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
  ...Object.values(DASHBOARD_ADMIN_SUB_PERMISSIONS).map((permissionKey) => ({
    module: 'dashboard',
    permissionKey,
  })),
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

export function hasAnyAdminDashboardPermission(permissions: Array<string>): boolean {
  if (hasFullAccess(permissions)) {
    return true
  }

  if (isPermissionGranted(permissions, DASHBOARD_PERMISSION_KEYS.admin, 'dashboard')) {
    return true
  }

  return Object.values(DASHBOARD_ADMIN_SUB_PERMISSIONS).some((key) =>
    isPermissionGranted(permissions, key, 'dashboard'),
  )
}

export function resolveDashboardVariant(
  permissions: Array<string>,
): DashboardVariantT | null {
  if (hasAnyAdminDashboardPermission(permissions)) {
    return 'admin'
  }

  if (
    isPermissionGranted(
      permissions,
      DASHBOARD_PERMISSION_KEYS.qc,
      'dashboard',
    )
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

  if (isPermissionGranted(permissions, 'data-entry.checker', 'data-entry')) {
    return 'qc'
  }

  if (isPermissionGranted(permissions, 'data-entry.maker', 'data-entry')) {
    return 'editor'
  }

  return null
}

