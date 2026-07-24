import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

import {
  SECURITY_LEVEL_CONFIG_PERMISSION,
  SECURITY_LEVEL_CREATE_PERMISSION,
  SECURITY_LEVEL_DELETE_PERMISSION,
  SECURITY_LEVEL_UPDATE_PERMISSION,
  SECURITY_LEVEL_VIEW_PERMISSION,
} from './securityLevelManagementPermissions'

const SECURITY_LEVELS_MODULE = 'security-levels'

export function canViewSecurityLevels(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    SECURITY_LEVEL_VIEW_PERMISSION,
    SECURITY_LEVELS_MODULE,
  )
}

export function canCreateSecurityLevels(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    SECURITY_LEVEL_CREATE_PERMISSION,
    SECURITY_LEVELS_MODULE,
  )
}

export function canUpdateSecurityLevels(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    SECURITY_LEVEL_UPDATE_PERMISSION,
    SECURITY_LEVELS_MODULE,
  )
}

export function canDeleteSecurityLevels(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    SECURITY_LEVEL_DELETE_PERMISSION,
    SECURITY_LEVELS_MODULE,
  )
}

export function canConfigSecurityLevels(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    SECURITY_LEVEL_CONFIG_PERMISSION,
    SECURITY_LEVELS_MODULE,
  )
}
