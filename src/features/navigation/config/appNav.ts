import {
  BarChart3,
  ClipboardCheck,
  FolderTree,
  LayoutDashboard,
  Settings2,
  Shield,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export type AppScreenTo =
  | '/app/dashboard'
  | '/app/users'
  | '/app/groups'
  | '/app/data'
  | '/app/review'
  | '/app/kpi'
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
}

export type AppScreenLabelKey =
  | 'admin.dashboard'
  | 'admin.users'
  | 'admin.groups'
  | 'admin.dataManagement'
  | 'admin.review'
  | 'admin.kpi'
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

export const APP_SCREENS: AppScreen[] = [
  {
    id: 'dashboard',
    to: '/app/dashboard',
    labelKey: 'admin.dashboard',
    icon: LayoutDashboard,
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
    requiredPermission: [
      { module: 'dossiers' },
      { module: 'data-entry' },
    ],
  },
  {
    id: 'data-config',
    labelKey: 'admin.dataConfig.title',
    icon: Settings2,
    requiredPermission: { module: 'roles' },
    children: [
      {
        id: 'document-types',
        to: '/app/data-config/document-types',
        labelKey: 'admin.dataConfig.documentTypes',
      },
      {
        id: 'document-assignment',
        to: '/app/data-config/document-assignment',
        labelKey: 'admin.dataConfig.documentAssignment',
      },
    ],
  },
  {
    id: 'review',
    to: '/app/review',
    labelKey: 'admin.review',
    icon: ClipboardCheck,
    requiredPermission: { module: 'data-entry' },
  },
  {
    id: 'kpi',
    to: '/app/kpi',
    labelKey: 'admin.kpi',
    icon: BarChart3,
    requiredPermission: { module: 'audit_logs' },
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
