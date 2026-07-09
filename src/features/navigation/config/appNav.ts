import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  ClipboardList,
  FolderOpen,
  FolderTree,
  LayoutDashboard,
  Library,
  ScanLine,
  Settings2,
  Shield,
  Users,
  UsersRound,
} from 'lucide-react'

import { DATA_ENTRY_SCREEN_REQUIREMENTS } from '@/features/data-management/lib/resolveDataManagementRole'
import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export type AppScreenTo =
  | '/app/dashboard'
  | '/app/project-manager'
  | '/app/plan-management'
  | '/app/archive-fonds'
  | '/app/retention-periods'
  | '/app/inventories'
  | '/app/dossier-types'
  | '/app/users'
  | '/app/groups'
  | '/app/data'
  | '/app/dossiers'
  | '/app/scan-intake'
  | '/app/permissions/function-matrix'
  | '/app/data-config/document-types'
  | '/app/data-config/document-assignment'
  | '/app/data-config/metadata-export-presets'
  | '/app/data-config/notification-configs'

export type AppScreenPermissionRequirement =
  | ScreenPermissionRequirement
  | Array<ScreenPermissionRequirement>

export type AppScreenChildLabelKey =
  | 'admin.generalCatalog.archiveFond'
  | 'admin.generalCatalog.retentionPeriod'
  | 'admin.generalCatalog.inventory'
  | 'admin.generalCatalog.dossierType'
  | 'admin.dataConfig.documentTypes'
  | 'admin.dataConfig.documentAssignment'
  | 'admin.dataConfig.metadataExportPresets'
  | 'admin.dataConfig.notificationConfigs'

export type AppScreenChild = {
  id: string
  to: AppScreenTo
  labelKey: AppScreenChildLabelKey
  requiredPermission?: ScreenPermissionRequirement
}

export type AppScreenLabelKey =
  | 'admin.dashboard'
  | 'admin.projectManager'
  | 'admin.planManagement'
  | 'admin.generalCatalog.title'
  | 'admin.users'
  | 'admin.groups'
  | 'admin.dataManagement'
  | 'admin.dossierManagement'
  | 'admin.scanIntake'
  | 'admin.permissions'
  | 'admin.dataConfig.title'

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
    id: 'project-manager',
    to: '/app/project-manager',
    labelKey: 'admin.projectManager',
    icon: Briefcase,
    requiredPermission: { module: 'projects', permissionKey: 'projects.read' },
  },
  {
    id: 'plan-management',
    to: '/app/plan-management',
    labelKey: 'admin.planManagement',
    icon: ClipboardList,
    requiredPermission: {
      module: 'project-plans',
      permissionKey: 'project-plans.read',
    },
  },
  {
    id: 'general-catalog',
    labelKey: 'admin.generalCatalog.title',
    icon: Library,
    children: [
      {
        id: 'archive-fond',
        to: '/app/archive-fonds',
        labelKey: 'admin.generalCatalog.archiveFond',
        requiredPermission: {
          module: 'fonds',
          permissionKey: 'fonds.read',
        },
      },
      {
        id: 'retention-period',
        to: '/app/retention-periods',
        labelKey: 'admin.generalCatalog.retentionPeriod',
        requiredPermission: {
          module: 'retention-periods',
          permissionKey: 'retention-periods.read',
        },
      },
      {
        id: 'inventory',
        to: '/app/inventories',
        labelKey: 'admin.generalCatalog.inventory',
        requiredPermission: {
          module: 'inventories',
          permissionKey: 'inventories.read',
        },
      },
      {
        id: 'dossier-type',
        to: '/app/dossier-types',
        labelKey: 'admin.generalCatalog.dossierType',
        requiredPermission: {
          module: 'dossier-types',
          permissionKey: 'dossier-types.read',
        },
      },
    ],
  },
  {
    id: 'users',
    to: '/app/users',
    labelKey: 'admin.users',
    icon: Users,
    requiredPermission: {
      module: 'users',
      permissionKey: 'users.read',
    },
  },
  {
    id: 'groups',
    to: '/app/groups',
    labelKey: 'admin.groups',
    icon: UsersRound,
    requiredPermission: { module: 'groups' },
  },
  {
    id: 'data',
    to: '/app/data',
    labelKey: 'admin.dataManagement',
    icon: FolderTree,
    requiredPermission: DATA_ENTRY_SCREEN_REQUIREMENTS,
  },
  {
    id: 'scan-intake',
    to: '/app/scan-intake',
    labelKey: 'admin.scanIntake',
    icon: ScanLine,
    requiredPermission: {
      module: 'scan-intake',
      permissionKey: 'scan-intake.use',
    },
  },
  {
    id: 'dossiers',
    to: '/app/dossiers',
    labelKey: 'admin.dossierManagement',
    icon: FolderOpen,
  },
  {
    id: 'data-config',
    labelKey: 'admin.dataConfig.title',
    icon: Settings2,
    children: [
      {
        id: 'document-types',
        to: '/app/data-config/document-types',
        labelKey: 'admin.dataConfig.documentTypes',
        requiredPermission: {
          module: 'metadata',
          permissionKey: 'metadata.templates.manage',
        },
      },
      {
        id: 'document-assignment',
        to: '/app/data-config/document-assignment',
        labelKey: 'admin.dataConfig.documentAssignment',
        requiredPermission: {
          module: 'metadata',
          permissionKey: 'metadata.permissions.manage',
        },
      },
      {
        id: 'metadata-export-presets',
        to: '/app/data-config/metadata-export-presets',
        labelKey: 'admin.dataConfig.metadataExportPresets',
        requiredPermission: {
          module: 'metadata',
          permissionKey: 'metadata.export_presets.manage',
        },
      },
      {
        id: 'notification-configs',
        to: '/app/data-config/notification-configs',
        labelKey: 'admin.dataConfig.notificationConfigs',
        requiredPermission: {
          module: 'roles',
          permissionKey: 'roles.manage',
        },
      },
    ],
  },
  {
    id: 'permissions',
    to: '/app/permissions/function-matrix',
    labelKey: 'admin.permissions',
    icon: Shield,
    requiredPermission: { module: 'roles' },
  },
]

export function getAppScreenRoutes(screen: AppScreen): Array<AppScreenTo> {
  if (screen.children?.length) {
    return screen.children.map((child) => child.to)
  }
  return screen.to ? [screen.to] : []
}
