import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'
import {
  hasFullAccess,
  isPermissionGranted,
} from '@/features/permissions/lib/permissionRules'

export const DASHBOARD_PERSONAL_SECTION_KEYS = {
  editorSummary: 'dashboard.personal.editor_summary',
  editorAccuracy: 'dashboard.personal.editor_accuracy',
  editorPerformance: 'dashboard.personal.editor_performance',
  editorCharts: 'dashboard.personal.editor_charts',
  qcSummary: 'dashboard.personal.qc_summary',
  qcByStep: 'dashboard.personal.qc_by_step',
  qcEfficiency: 'dashboard.personal.qc_efficiency',
} as const

export const DASHBOARD_TEAM_SECTION_KEYS = {
  qcGroup: 'dashboard.team.qc_group',
  employeeKpis: 'dashboard.team.employee_kpis',
  groupPerformance: 'dashboard.team.group_performance',
} as const

export const DASHBOARD_OVERVIEW_SECTION_KEYS = {
  summary: 'dashboard.overview.summary',
  dossierStatusChart: 'dashboard.overview.dossier_status_chart',
  projectStatusChart: 'dashboard.overview.project_status_chart',
  dossierTrendChart: 'dashboard.overview.dossier_trend_chart',
  systemPerformance: 'dashboard.overview.system_performance',
} as const

export const DASHBOARD_WAREHOUSE_SECTION_KEYS = {
  dossierDistribution: 'dashboard.warehouse.dossier_distribution',
  borrowStats: 'dashboard.warehouse.borrow_stats',
  capacity: 'dashboard.warehouse.capacity',
  intakeChart: 'dashboard.warehouse.intake_chart',
  unplaced: 'dashboard.warehouse.unplaced',
  fonds: 'dashboard.warehouse.fonds',
  disposal: 'dashboard.warehouse.disposal',
} as const

export const DASHBOARD_CAPABILITY_KEYS = {
  unassigned: 'dashboard.admin.unassigned',
  readAll: 'dashboard.admin.read_all',
} as const

/** @deprecated Prefer modular section keys. Kept for legacy role JSON. */
export const DASHBOARD_PERMISSION_KEYS = {
  editor: 'dashboard.editor',
  qc: 'dashboard.qc',
  admin: 'dashboard.admin',
  warehouse: 'dashboard.warehouse',
  personal: 'dashboard.personal',
  team: 'dashboard.team',
  overview: 'dashboard.overview',
} as const

/** @deprecated Prefer DASHBOARD_OVERVIEW_SECTION_KEYS / DASHBOARD_TEAM_SECTION_KEYS. */
export const DASHBOARD_ADMIN_SUB_PERMISSIONS = {
  summary: DASHBOARD_OVERVIEW_SECTION_KEYS.summary,
  dossierStatusChart: DASHBOARD_OVERVIEW_SECTION_KEYS.dossierStatusChart,
  projectStatusChart: DASHBOARD_OVERVIEW_SECTION_KEYS.projectStatusChart,
  dossierTrendChart: DASHBOARD_OVERVIEW_SECTION_KEYS.dossierTrendChart,
  systemPerformance: DASHBOARD_OVERVIEW_SECTION_KEYS.systemPerformance,
  employeeKpis: DASHBOARD_TEAM_SECTION_KEYS.employeeKpis,
  groupPerformanceChart: DASHBOARD_TEAM_SECTION_KEYS.groupPerformance,
  unassigned: DASHBOARD_CAPABILITY_KEYS.unassigned,
  readAll: DASHBOARD_CAPABILITY_KEYS.readAll,
} as const

const LEGACY_KEY_ALIASES: Record<string, string> = {
  'dashboard.admin.summary': DASHBOARD_OVERVIEW_SECTION_KEYS.summary,
  'dashboard.admin.dossier_status_chart':
    DASHBOARD_OVERVIEW_SECTION_KEYS.dossierStatusChart,
  'dashboard.admin.project_status_chart':
    DASHBOARD_OVERVIEW_SECTION_KEYS.projectStatusChart,
  'dashboard.admin.dossier_trend_chart':
    DASHBOARD_OVERVIEW_SECTION_KEYS.dossierTrendChart,
  'dashboard.admin.system_performance':
    DASHBOARD_OVERVIEW_SECTION_KEYS.systemPerformance,
  'dashboard.admin.employee_kpis': DASHBOARD_TEAM_SECTION_KEYS.employeeKpis,
  'dashboard.admin.group_performance_chart':
    DASHBOARD_TEAM_SECTION_KEYS.groupPerformance,
}

const LEGACY_GRANT_EXPANSIONS: Record<string, ReadonlyArray<string>> = {
  'dashboard.editor': [
    DASHBOARD_PERSONAL_SECTION_KEYS.editorSummary,
    DASHBOARD_PERSONAL_SECTION_KEYS.editorAccuracy,
    DASHBOARD_PERSONAL_SECTION_KEYS.editorPerformance,
    DASHBOARD_PERSONAL_SECTION_KEYS.editorCharts,
  ],
  'dashboard.qc': [
    DASHBOARD_PERSONAL_SECTION_KEYS.qcSummary,
    DASHBOARD_PERSONAL_SECTION_KEYS.qcByStep,
    DASHBOARD_PERSONAL_SECTION_KEYS.qcEfficiency,
    DASHBOARD_TEAM_SECTION_KEYS.qcGroup,
  ],
  'dashboard.admin': [
    ...Object.values(DASHBOARD_OVERVIEW_SECTION_KEYS),
    DASHBOARD_TEAM_SECTION_KEYS.employeeKpis,
    DASHBOARD_TEAM_SECTION_KEYS.groupPerformance,
    DASHBOARD_CAPABILITY_KEYS.unassigned,
    DASHBOARD_CAPABILITY_KEYS.readAll,
  ],
  'dashboard.personal': Object.values(DASHBOARD_PERSONAL_SECTION_KEYS),
  'dashboard.team': Object.values(DASHBOARD_TEAM_SECTION_KEYS),
  'dashboard.overview': Object.values(DASHBOARD_OVERVIEW_SECTION_KEYS),
  'dashboard.warehouse': Object.values(DASHBOARD_WAREHOUSE_SECTION_KEYS),
}

export type DashboardSectionGroupT =
  | 'personal'
  | 'team'
  | 'overview'
  | 'warehouse'

export const ALL_DASHBOARD_SECTION_KEYS = [
  ...Object.values(DASHBOARD_PERSONAL_SECTION_KEYS),
  ...Object.values(DASHBOARD_TEAM_SECTION_KEYS),
  ...Object.values(DASHBOARD_OVERVIEW_SECTION_KEYS),
  ...Object.values(DASHBOARD_WAREHOUSE_SECTION_KEYS),
  ...Object.values(DASHBOARD_CAPABILITY_KEYS),
  ...Object.values(DASHBOARD_PERMISSION_KEYS),
] as const

export const DASHBOARD_SCREEN_REQUIREMENTS = [
  ...ALL_DASHBOARD_SECTION_KEYS.map((permissionKey) => ({
    module: 'dashboard',
    permissionKey,
  })),
  {
    module: 'data-entry',
    permissionKey: 'data-entry.maker',
  },
  {
    module: 'data-entry',
    permissionKey: 'data-entry.checker',
  },
] as const satisfies ReadonlyArray<ScreenPermissionRequirement>

function normalizeDashboardKey(key: string): string {
  return LEGACY_KEY_ALIASES[key] ?? key
}

export function isDashboardPermissionGranted(
  permissions: Array<string>,
  permissionKey: string,
): boolean {
  const normalizedKey = normalizeDashboardKey(permissionKey)

  if (isPermissionGranted(permissions, normalizedKey, 'dashboard')) {
    return true
  }

  if (
    permissionKey !== normalizedKey &&
    isPermissionGranted(permissions, permissionKey, 'dashboard')
  ) {
    return true
  }

  for (const [legacyKey, modernKey] of Object.entries(LEGACY_KEY_ALIASES)) {
    if (
      modernKey === normalizedKey &&
      isPermissionGranted(permissions, legacyKey, 'dashboard')
    ) {
      return true
    }
  }

  for (const [legacyGrant, expanded] of Object.entries(LEGACY_GRANT_EXPANSIONS)) {
    if (
      expanded.includes(normalizedKey) &&
      isPermissionGranted(permissions, legacyGrant, 'dashboard')
    ) {
      return true
    }
  }

  if (isPermissionGranted(permissions, 'data-entry.maker', 'data-entry')) {
    if (
      normalizedKey.startsWith('dashboard.personal.editor_') ||
      LEGACY_GRANT_EXPANSIONS['dashboard.editor']?.includes(normalizedKey)
    ) {
      return true
    }
  }

  if (isPermissionGranted(permissions, 'data-entry.checker', 'data-entry')) {
    if (
      normalizedKey.startsWith('dashboard.personal.qc_') ||
      normalizedKey === DASHBOARD_TEAM_SECTION_KEYS.qcGroup
    ) {
      return true
    }
  }

  return false
}

export function isDashboardSectionHidden(
  hidden: Array<string> | null | undefined,
  permissionKey: string,
): boolean {
  if (!hidden || hidden.length === 0) {
    return false
  }

  const normalizedKey = normalizeDashboardKey(permissionKey)

  for (const pattern of hidden) {
    if (pattern === '*') {
      return true
    }
    if (pattern === 'dashboard.*') {
      return true
    }
    if (pattern === permissionKey || pattern === normalizedKey) {
      return true
    }
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2)
      if (
        normalizedKey === prefix ||
        normalizedKey.startsWith(`${prefix}.`) ||
        permissionKey === prefix ||
        permissionKey.startsWith(`${prefix}.`)
      ) {
        return true
      }
    }

    const expansion = LEGACY_GRANT_EXPANSIONS[pattern]
    if (
      expansion?.includes(normalizedKey) ||
      expansion?.includes(permissionKey)
    ) {
      return true
    }
  }

  return false
}

export function isDashboardSectionVisible(
  permissions: Array<string>,
  hidden: Array<string>,
  permissionKey: string,
): boolean {
  if (isDashboardSectionHidden(hidden, permissionKey)) {
    return false
  }
  return isDashboardPermissionGranted(permissions, permissionKey)
}

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

export function hasAnyPersonalDashboardSection(
  permissions: Array<string>,
  hidden: Array<string> = [],
): boolean {
  return Object.values(DASHBOARD_PERSONAL_SECTION_KEYS).some((key) =>
    isDashboardSectionVisible(permissions, hidden, key),
  )
}

export function hasAnyTeamDashboardSection(
  permissions: Array<string>,
  hidden: Array<string> = [],
): boolean {
  return Object.values(DASHBOARD_TEAM_SECTION_KEYS).some((key) =>
    isDashboardSectionVisible(permissions, hidden, key),
  )
}

export function hasAnyOverviewDashboardSection(
  permissions: Array<string>,
  hidden: Array<string> = [],
): boolean {
  return Object.values(DASHBOARD_OVERVIEW_SECTION_KEYS).some((key) =>
    isDashboardSectionVisible(permissions, hidden, key),
  )
}

export function hasAnyWarehouseDashboardSection(
  permissions: Array<string>,
  hidden: Array<string> = [],
): boolean {
  if (isDashboardSectionVisible(permissions, hidden, 'dashboard.warehouse')) {
    return Object.values(DASHBOARD_WAREHOUSE_SECTION_KEYS).some(
      (key) => !isDashboardSectionHidden(hidden, key),
    )
  }

  return Object.values(DASHBOARD_WAREHOUSE_SECTION_KEYS).some((key) =>
    isDashboardSectionVisible(permissions, hidden, key),
  )
}

export function hasOverviewTabAccess(
  permissions: Array<string>,
  hidden: Array<string> = [],
): boolean {
  return (
    hasAnyPersonalDashboardSection(permissions, hidden) ||
    hasAnyTeamDashboardSection(permissions, hidden) ||
    hasAnyOverviewDashboardSection(permissions, hidden)
  )
}

export function needsEditorDashboardData(
  permissions: Array<string>,
  hidden: Array<string> = [],
): boolean {
  return [
    DASHBOARD_PERSONAL_SECTION_KEYS.editorSummary,
    DASHBOARD_PERSONAL_SECTION_KEYS.editorAccuracy,
    DASHBOARD_PERSONAL_SECTION_KEYS.editorPerformance,
    DASHBOARD_PERSONAL_SECTION_KEYS.editorCharts,
  ].some((key) => isDashboardSectionVisible(permissions, hidden, key))
}

export function needsQcDashboardData(
  permissions: Array<string>,
  hidden: Array<string> = [],
): boolean {
  return [
    DASHBOARD_PERSONAL_SECTION_KEYS.qcSummary,
    DASHBOARD_PERSONAL_SECTION_KEYS.qcByStep,
    DASHBOARD_PERSONAL_SECTION_KEYS.qcEfficiency,
  ].some((key) => isDashboardSectionVisible(permissions, hidden, key))
}

export function needsQcGroupDashboardData(
  permissions: Array<string>,
  hidden: Array<string> = [],
): boolean {
  return isDashboardSectionVisible(
    permissions,
    hidden,
    DASHBOARD_TEAM_SECTION_KEYS.qcGroup,
  )
}

export function needsAdminDashboardData(
  permissions: Array<string>,
  hidden: Array<string> = [],
): boolean {
  return (
    hasAnyOverviewDashboardSection(permissions, hidden) ||
    isDashboardSectionVisible(
      permissions,
      hidden,
      DASHBOARD_TEAM_SECTION_KEYS.employeeKpis,
    ) ||
    isDashboardSectionVisible(
      permissions,
      hidden,
      DASHBOARD_TEAM_SECTION_KEYS.groupPerformance,
    )
  )
}

/** @deprecated Variant switching removed — modular sections only. */
export type DashboardVariantT = 'editor' | 'qc' | 'admin' | 'warehouse'

/** @deprecated Use modular section visibility helpers instead. */
export function resolveDashboardVariant(
  permissions: Array<string>,
): DashboardVariantT | null {
  if (needsAdminDashboardData(permissions)) {
    return 'admin'
  }
  if (needsQcDashboardData(permissions) || needsQcGroupDashboardData(permissions)) {
    return 'qc'
  }
  if (needsEditorDashboardData(permissions)) {
    return 'editor'
  }
  if (hasAnyWarehouseDashboardSection(permissions)) {
    return 'warehouse'
  }
  return null
}

/** @deprecated Prefer needsAdminDashboardData / overview section helpers. */
export function hasAnyAdminDashboardPermission(
  permissions: Array<string>,
): boolean {
  return needsAdminDashboardData(permissions)
}
