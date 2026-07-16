import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

import {
  PHYSICAL_WAREHOUSE_CONTENTS_PERMISSIONS,
  PHYSICAL_WAREHOUSE_ITEM_READ_PERMISSION,
  PHYSICAL_WAREHOUSE_LOCATION_MANAGE_PERMISSION,
  PHYSICAL_WAREHOUSE_LOCATION_MANAGE_PERMISSIONS,
  PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE_PERMISSION,
  PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE_PERMISSIONS,
} from './physicalWarehousePermissions'

const MODULE = 'physical-warehouse'

function hasAnyPermission(
  permissions: Array<string>,
  keys: ReadonlyArray<string>,
): boolean {
  return keys.some((key) => isPermissionGranted(permissions, key, MODULE))
}

/** Xem sơ đồ kho và quản lý cấu trúc bên trong kho. */
export function canViewPhysicalWarehouse(permissions: Array<string>): boolean {
  return hasAnyPermission(permissions, PHYSICAL_WAREHOUSE_CONTENTS_PERMISSIONS)
}

export function canManagePhysicalWarehouseLocations(
  permissions: Array<string>,
): boolean {
  return hasAnyPermission(
    permissions,
    PHYSICAL_WAREHOUSE_LOCATION_MANAGE_PERMISSIONS,
  )
}

/** Thêm, sửa, xóa kho trực tiếp trong địa điểm. */
export function canManagePhysicalWarehouses(
  permissions: Array<string>,
): boolean {
  return hasAnyPermission(
    permissions,
    PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE_PERMISSIONS,
  )
}

/** Cấu trúc bên trong kho, hộp/cặp, xếp hồ sơ — gộp trong quyền xem. */
export function canManagePhysicalWarehouseContents(
  permissions: Array<string>,
): boolean {
  return canViewPhysicalWarehouse(permissions)
}

export function canManagePhysicalWarehouseItems(
  permissions: Array<string>,
): boolean {
  return (
    canManagePhysicalWarehouseLocations(permissions) ||
    canManagePhysicalWarehouses(permissions) ||
    canManagePhysicalWarehouseContents(permissions)
  )
}

export {
  PHYSICAL_WAREHOUSE_ITEM_READ_PERMISSION,
  PHYSICAL_WAREHOUSE_LOCATION_MANAGE_PERMISSION,
  PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE_PERMISSION,
}
