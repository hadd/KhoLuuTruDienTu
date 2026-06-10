import {
  BarChart3,
  ClipboardCheck,
  FolderTree,
  Shield,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export type AppScreenTo =
  | '/app/users'
  | '/app/groups'
  | '/app/data'
  | '/app/review'
  | '/app/kpi'
  | '/app/permissions/function-matrix'

export type AppScreenPermissionRequirement =
  | ScreenPermissionRequirement
  | ScreenPermissionRequirement[]

export type AppScreen = {
  id: string
  to: AppScreenTo
  labelKey:
    | 'admin.users'
    | 'admin.groups'
    | 'admin.dataManagement'
    | 'admin.review'
    | 'admin.kpi'
    | 'admin.permissions'
  icon: LucideIcon
  requiredPermission: AppScreenPermissionRequirement
}

export const APP_SCREENS: AppScreen[] = [
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
