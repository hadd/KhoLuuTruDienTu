import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

import {
  PHYSICAL_WAREHOUSE_CONFIG_MANAGE_PERMISSION,
  PHYSICAL_WAREHOUSE_ITEM_MANAGE_PERMISSION,
  PHYSICAL_WAREHOUSE_ITEM_READ_PERMISSION,
} from './physicalWarehousePermissions'

const MODULE = 'physical-warehouse'

export function canViewPhysicalWarehouse(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    PHYSICAL_WAREHOUSE_ITEM_READ_PERMISSION,
    MODULE,
  )
}

export function canManagePhysicalWarehouseItems(
  permissions: Array<string>,
): boolean {
  return isPermissionGranted(
    permissions,
    PHYSICAL_WAREHOUSE_ITEM_MANAGE_PERMISSION,
    MODULE,
  )
}

export function canManagePhysicalWarehouseConfig(
  permissions: Array<string>,
): boolean {
  return isPermissionGranted(
    permissions,
    PHYSICAL_WAREHOUSE_CONFIG_MANAGE_PERMISSION,
    MODULE,
  )
}
