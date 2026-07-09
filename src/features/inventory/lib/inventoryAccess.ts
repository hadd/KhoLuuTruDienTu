import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

import {
  INVENTORY_CREATE_PERMISSION,
  INVENTORY_DELETE_PERMISSION,
  INVENTORY_UPDATE_PERMISSION,
  INVENTORY_VIEW_PERMISSION,
} from './inventoryManagementPermissions'

const INVENTORIES_MODULE = 'inventories'

export function canViewInventories(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    INVENTORY_VIEW_PERMISSION,
    INVENTORIES_MODULE,
  )
}

export function canCreateInventories(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    INVENTORY_CREATE_PERMISSION,
    INVENTORIES_MODULE,
  )
}

export function canUpdateInventories(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    INVENTORY_UPDATE_PERMISSION,
    INVENTORIES_MODULE,
  )
}

export function canDeleteInventories(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    INVENTORY_DELETE_PERMISSION,
    INVENTORIES_MODULE,
  )
}
