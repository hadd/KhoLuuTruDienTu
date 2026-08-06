import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  FileStack,
  LayoutDashboard,
  Library,
  ScrollText,
  Settings2,
  Users,
  Warehouse,
} from 'lucide-react'

import { ARCHIVE_DATA_HUB_SCREEN_REQUIREMENTS } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { DIGITIZATION_SCREEN_REQUIREMENTS } from '@/features/digitization/lib/digitizationAccess'
import { GENERAL_CATALOG_SCREEN_REQUIREMENTS } from '@/features/general-catalog/lib/generalCatalogAccess'
import { PROJECT_MANAGEMENT_SCREEN_REQUIREMENTS } from '@/features/project-management/lib/projectManagementAccess'
import { USER_MANAGEMENT_SCREEN_REQUIREMENTS } from '@/features/user/lib/userManagementAccess'
import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export type AppScreenTo =
  | '/app/dashboard'
  | '/app/library'
  | '/app/project-management'
  | '/app/project-manager'
  | '/app/plan-management'
  | '/app/general-catalog'
  | '/app/archive-fonds'
  | '/app/retention-periods'
  | '/app/inventories'
  | '/app/dossier-types'
  | '/app/document-types'
  | '/app/warehouse-management'
  | '/app/archive-warehouse'
  | '/app/archive-dossiers'
  | '/app/physical-warehouse'
  | '/app/user-management'
  | '/app/users'
  | '/app/groups'
  | '/app/digitization'
  | '/app/data'
  | '/app/dossiers'
  | '/app/scan-intake'
  | '/app/permissions/function-matrix'
  | '/app/data-config'
  | '/app/data-config/document-types'
  | '/app/data-config/document-assignment'
  | '/app/data-config/metadata-export-presets'
  | '/app/data-config/notification-configs'
  | '/app/data-config/watermark-configs'
  | '/app/data-config/document-naming'
  | '/app/data-config/audit-log-config'
  | '/app/data-config/borrow-approval-clearance'
  | '/app/security-levels'
  | '/app/audit-logs'

export type AppScreenPermissionRequirement =
  | ScreenPermissionRequirement
  | Array<ScreenPermissionRequirement>

export type AppScreenChildLabelKey = 'admin.physicalWarehouse'

export type AppScreenChild = {
  id: string
  to: AppScreenTo
  labelKey: AppScreenChildLabelKey
  requiredPermission?: AppScreenPermissionRequirement
}

export type AppScreenLabelKey =
  | 'admin.dashboard'
  | 'admin.library'
  | 'admin.projectManagement'
  | 'admin.generalCatalog.title'
  | 'admin.warehouseManagement'
  | 'admin.users'
  | 'admin.digitization'
  | 'admin.dataConfig.title'
  | 'admin.auditLogs'

export type AppScreen = {
  id: string
  to?: AppScreenTo
  labelKey: AppScreenLabelKey
  icon: LucideIcon
  requiredPermission?: AppScreenPermissionRequirement
  children?: Array<AppScreenChild>
}

/** Sidebar screens visible to every authenticated role. */
export const ALWAYS_VISIBLE_SCREEN_IDS = [] as const

export function isAlwaysVisibleScreen(screenId: string): boolean {
  return (ALWAYS_VISIBLE_SCREEN_IDS as ReadonlyArray<string>).includes(screenId)
}

export const APP_SCREENS: Array<AppScreen> = [
  {
    id: 'dashboard',
    to: '/app/dashboard',
    labelKey: 'admin.dashboard',
    icon: LayoutDashboard,
    requiredPermission: [
      { module: 'dashboard', permissionKey: 'dashboard.editor' },
      { module: 'dashboard', permissionKey: 'dashboard.qc' },
      { module: 'dashboard', permissionKey: 'dashboard.admin' },
    ],
  },
  {
    id: 'library',
    to: '/app/library',
    labelKey: 'admin.library',
    icon: Library,
  },
  {
    id: 'project-management',
    to: '/app/project-management',
    labelKey: 'admin.projectManagement',
    icon: Briefcase,
    requiredPermission: [...PROJECT_MANAGEMENT_SCREEN_REQUIREMENTS],
  },
  {
    id: 'general-catalog',
    to: '/app/general-catalog',
    labelKey: 'admin.generalCatalog.title',
    icon: Library,
    requiredPermission: [...GENERAL_CATALOG_SCREEN_REQUIREMENTS],
  },
  {
    id: 'warehouse-management',
    to: '/app/warehouse-management',
    labelKey: 'admin.warehouseManagement',
    icon: Warehouse,
    requiredPermission: [
      ...ARCHIVE_DATA_HUB_SCREEN_REQUIREMENTS,
      {
        module: 'physical-warehouse',
        permissionKey: 'physical-warehouse.item.read',
      },
    ],
  },
  {
    id: 'users',
    to: '/app/user-management',
    labelKey: 'admin.users',
    icon: Users,
    requiredPermission: [...USER_MANAGEMENT_SCREEN_REQUIREMENTS],
  },
  {
    id: 'digitization',
    to: '/app/digitization',
    labelKey: 'admin.digitization',
    icon: FileStack,
    requiredPermission: [...DIGITIZATION_SCREEN_REQUIREMENTS],
  },
  {
    id: 'audit-logs',
    to: '/app/audit-logs',
    labelKey: 'admin.auditLogs',
    icon: ScrollText,
    requiredPermission: {
      module: 'audit_logs',
      permissionKey: 'audit_logs.read',
    },
  },
  {
    id: 'data-config',
    to: '/app/data-config',
    labelKey: 'admin.dataConfig.title',
    icon: Settings2,
  },
]

export function getAppScreenRoutes(screen: AppScreen): Array<AppScreenTo> {
  if (screen.children?.length) {
    return screen.children.map((child) => child.to)
  }
  return screen.to ? [screen.to] : []
}
