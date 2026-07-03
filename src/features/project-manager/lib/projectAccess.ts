import type { AppRoleT } from '@/features/auth/constants'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

import {
  PROJECT_CREATE_PERMISSION,
  PROJECT_DELETE_PERMISSION,
  PROJECT_UPDATE_PERMISSION,
  PROJECT_VIEW_PERMISSION,
} from './projectManagerPermissions'

const PROJECTS_MODULE = 'projects'

export function hasGlobalProjectScope(
  permissions: Array<string>,
  primaryAppRole?: AppRoleT | null,
): boolean {
  return primaryAppRole === 'admin'
}

export function canViewProjects(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    PROJECT_VIEW_PERMISSION,
    PROJECTS_MODULE,
  )
}

export function canCreateProjects(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    PROJECT_CREATE_PERMISSION,
    PROJECTS_MODULE,
  )
}

export function canUpdateProjects(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    PROJECT_UPDATE_PERMISSION,
    PROJECTS_MODULE,
  )
}

export function canDeleteProjects(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    PROJECT_DELETE_PERMISSION,
    PROJECTS_MODULE,
  )
}
