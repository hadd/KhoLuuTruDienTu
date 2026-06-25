import {
  Briefcase,
  ClipboardList,
  FolderOpen,
  FolderTree,
  LayoutDashboard,
  Settings2,
  Shield,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'
import {
  DATA_ENTRY_MAKER_PERMISSION,
  DATA_ENTRY_MODULE,
} from '@/features/data-management/lib/resolveDataManagementRole'

export type AppScreenTo =
  | '/app/dashboard'
  | '/app/project-manager'
  | '/app/plan-management'
  | '/app/users'
  | '/app/groups'
  | '/app/data'
  | '/app/dossiers'
  | '/app/permissions/function-matrix'
  | '/app/data-config/document-types'
  | '/app/data-config/document-assignment'

export type AppScreenPermissionRequirement =
  | ScreenPermissionRequirement
  | ScreenPermissionRequirement[]

export type AppScreenChildLabelKey =
  | 'admin.dataConfig.documentTypes'
  | 'admin.dataConfig.documentAssignment'

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
  | 'admin.users'
  | 'admin.groups'
  | 'admin.dataManagement'
  | 'admin.dossierManagement'
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
export const ALWAYS_VISIBLE_SCREEN_IDS = ['data'] as const

export function isAlwaysVisibleScreen(screenId: string): boolean {
  return (ALWAYS_VISIBLE_SCREEN_IDS as ReadonlyArray<string>).includes(screenId)
}

export const APP_SCREENS: AppScreen[] = [
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
    requiredPermission: { module: 'projects' },
  },
  {
    id: 'plan-management',
    to: '/app/plan-management',
    labelKey: 'admin.planManagement',
    icon: ClipboardList,
    requiredPermission: { module: 'projects' },
  },
  {
    id: 'users',
    to: '/app/users',
    labelKey: 'admin.users',
    icon: Users,
    requiredPermission: { module: 'users' },
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
  },
  {
    id: 'dossiers',
    to: '/app/dossiers',
    labelKey: 'admin.dossierManagement',
    icon: FolderOpen,
    requiredPermission: {
      module: DATA_ENTRY_MODULE,
      permissionKey: DATA_ENTRY_MAKER_PERMISSION,
    },
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
          permissionKey: 'metadata.templates',
        },
      },
      {
        id: 'document-assignment',
        to: '/app/data-config/document-assignment',
        labelKey: 'admin.dataConfig.documentAssignment',
        requiredPermission: {
          module: 'metadata',
          permissionKey: 'metadata.field_permissions',
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
