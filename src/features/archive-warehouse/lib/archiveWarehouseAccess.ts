import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

const MODULE = 'archive.warehouse'

export const ARCHIVE_WAREHOUSE_PERMISSIONS = {
  read: 'archive.warehouse.read',
  search: 'archive.warehouse.search',
  edit: 'archive.warehouse.edit',
  delete: 'archive.warehouse.delete',
  reupload: 'archive.warehouse.reupload',
} as const

/** Màn danh sách/chi tiết hồ sơ kho — OR các quyền kho. */
export const ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS = [
  {
    module: MODULE,
    permissionKey: ARCHIVE_WAREHOUSE_PERMISSIONS.read,
  },
  {
    module: MODULE,
    permissionKey: ARCHIVE_WAREHOUSE_PERMISSIONS.search,
  },
  {
    module: MODULE,
    permissionKey: ARCHIVE_WAREHOUSE_PERMISSIONS.edit,
  },
  {
    module: MODULE,
    permissionKey: ARCHIVE_WAREHOUSE_PERMISSIONS.delete,
  },
  {
    module: MODULE,
    permissionKey: ARCHIVE_WAREHOUSE_PERMISSIONS.reupload,
  },
] as const satisfies Array<ScreenPermissionRequirement>

/** Khớp BE `hasArchiveWarehousePermission`: read → search. */
export function hasArchiveWarehousePermission(
  permissions: Array<string>,
  permissionKey: string,
): boolean {
  if (isPermissionGranted(permissions, permissionKey, MODULE)) {
    return true
  }

  if (
    permissionKey === ARCHIVE_WAREHOUSE_PERMISSIONS.search &&
    isPermissionGranted(permissions, ARCHIVE_WAREHOUSE_PERMISSIONS.read, MODULE)
  ) {
    return true
  }

  return false
}

export function canEditArchiveWarehouse(permissions: Array<string>): boolean {
  return hasArchiveWarehousePermission(
    permissions,
    ARCHIVE_WAREHOUSE_PERMISSIONS.edit,
  )
}

export function canDeleteArchiveWarehouse(permissions: Array<string>): boolean {
  return hasArchiveWarehousePermission(
    permissions,
    ARCHIVE_WAREHOUSE_PERMISSIONS.delete,
  )
}

export function canReuploadArchiveWarehouse(
  permissions: Array<string>,
): boolean {
  return hasArchiveWarehousePermission(
    permissions,
    ARCHIVE_WAREHOUSE_PERMISSIONS.reupload,
  )
}

/** Xếp / chuyển vị trí kho vật lý từ chi tiết hồ sơ kho — khớp BE (edit). */
export function canManageArchiveWarehousePhysical(
  permissions: Array<string>,
): boolean {
  return (
    canEditArchiveWarehouse(permissions) ||
    isPermissionGranted(
      permissions,
      'physical-warehouse.item.manage',
      'physical-warehouse',
    )
  )
}

/** Gỡ vị trí kho vật lý — khớp BE (edit hoặc delete). */
export function canRemoveArchiveWarehousePhysical(
  permissions: Array<string>,
): boolean {
  return (
    canEditArchiveWarehouse(permissions) ||
    canDeleteArchiveWarehouse(permissions) ||
    isPermissionGranted(
      permissions,
      'physical-warehouse.item.manage',
      'physical-warehouse',
    )
  )
}
