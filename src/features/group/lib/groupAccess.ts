import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

import {
  GROUPS_CREATE_PERMISSION,
  GROUPS_DELETE_PERMISSION,
  GROUPS_MANAGE_MEMBERS_PERMISSION,
  GROUPS_MODULE,
  GROUPS_READ_ALL_PERMISSION,
  GROUPS_READ_PERMISSION,
  GROUPS_START_WORKFLOW_PERMISSION,
  GROUPS_UPDATE_PERMISSION,
} from './groupPermissions'

export function canViewGroups(permissions: Array<string>): boolean {
  return (
    isPermissionGranted(permissions, GROUPS_READ_PERMISSION, GROUPS_MODULE) ||
    isPermissionGranted(permissions, GROUPS_READ_ALL_PERMISSION, GROUPS_MODULE)
  )
}

export function canReadAllGroups(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    GROUPS_READ_ALL_PERMISSION,
    GROUPS_MODULE,
  )
}

export function canCreateGroup(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    GROUPS_CREATE_PERMISSION,
    GROUPS_MODULE,
  )
}

export function canUpdateGroup(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    GROUPS_UPDATE_PERMISSION,
    GROUPS_MODULE,
  )
}

export function canDeleteGroup(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    GROUPS_DELETE_PERMISSION,
    GROUPS_MODULE,
  )
}

export function canManageGroupMembers(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    GROUPS_MANAGE_MEMBERS_PERMISSION,
    GROUPS_MODULE,
  )
}

export function canStartGroupWorkflow(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    GROUPS_START_WORKFLOW_PERMISSION,
    GROUPS_MODULE,
  )
}
