import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

import {
  FOND_CREATE_PERMISSION,
  FOND_DELETE_PERMISSION,
  FOND_UPDATE_PERMISSION,
  FOND_VIEW_PERMISSION,
} from './fondManagementPermissions'

const FONDS_MODULE = 'fonds'

export function canViewFonds(permissions: Array<string>): boolean {
  return isPermissionGranted(permissions, FOND_VIEW_PERMISSION, FONDS_MODULE)
}

export function canCreateFonds(permissions: Array<string>): boolean {
  return isPermissionGranted(permissions, FOND_CREATE_PERMISSION, FONDS_MODULE)
}

export function canUpdateFonds(permissions: Array<string>): boolean {
  return isPermissionGranted(permissions, FOND_UPDATE_PERMISSION, FONDS_MODULE)
}

export function canDeleteFonds(permissions: Array<string>): boolean {
  return isPermissionGranted(permissions, FOND_DELETE_PERMISSION, FONDS_MODULE)
}
