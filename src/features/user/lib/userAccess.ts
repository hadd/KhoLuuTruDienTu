import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

import {
  USER_CREATE_PERMISSION,
  USER_DELETE_PERMISSION,
  USER_EXPORT_PERMISSION,
  USER_IMPORT_PERMISSION,
  USER_RESET_PASSWORD_PERMISSION,
  USER_UPDATE_PERMISSION,
  USER_VIEW_PERMISSION,
} from './userManagementPermissions'

const USERS_MODULE = 'users'

export function canViewUsers(permissions: Array<string>): boolean {
  return isPermissionGranted(permissions, USER_VIEW_PERMISSION, USERS_MODULE)
}

export function canCreateUsers(permissions: Array<string>): boolean {
  return isPermissionGranted(permissions, USER_CREATE_PERMISSION, USERS_MODULE)
}

export function canUpdateUsers(permissions: Array<string>): boolean {
  return isPermissionGranted(permissions, USER_UPDATE_PERMISSION, USERS_MODULE)
}

export function canDeleteUsers(permissions: Array<string>): boolean {
  return isPermissionGranted(permissions, USER_DELETE_PERMISSION, USERS_MODULE)
}

export function canImportUsers(permissions: Array<string>): boolean {
  return isPermissionGranted(permissions, USER_IMPORT_PERMISSION, USERS_MODULE)
}

export function canExportUsers(permissions: Array<string>): boolean {
  return isPermissionGranted(permissions, USER_EXPORT_PERMISSION, USERS_MODULE)
}

export function canResetUserPassword(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    USER_RESET_PASSWORD_PERMISSION,
    USERS_MODULE,
  )
}
