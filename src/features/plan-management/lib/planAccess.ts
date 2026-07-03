import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

import {
  PROJECT_PLAN_CREATE_PERMISSION,
  PROJECT_PLAN_DELETE_PERMISSION,
  PROJECT_PLAN_UPDATE_PERMISSION,
  PROJECT_PLAN_VIEW_PERMISSION,
} from './planManagementPermissions'

const PROJECT_PLANS_MODULE = 'project-plans'

export function canViewProjectPlans(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    PROJECT_PLAN_VIEW_PERMISSION,
    PROJECT_PLANS_MODULE,
  )
}

export function canCreateProjectPlans(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    PROJECT_PLAN_CREATE_PERMISSION,
    PROJECT_PLANS_MODULE,
  )
}

export function canUpdateProjectPlans(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    PROJECT_PLAN_UPDATE_PERMISSION,
    PROJECT_PLANS_MODULE,
  )
}

export function canDeleteProjectPlans(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    PROJECT_PLAN_DELETE_PERMISSION,
    PROJECT_PLANS_MODULE,
  )
}
