import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

const MODULE = 'archive.warehouse'

export const ARCHIVE_WAREHOUSE_PERMISSIONS = {
  read: 'archive.warehouse.read',
  search: 'archive.warehouse.search',
  edit: 'archive.warehouse.edit',
  delete: 'archive.warehouse.delete',
  reupload: 'archive.warehouse.reupload',
  downloadOriginal: 'archive.warehouse.download_original',
  downloadWatermark: 'archive.warehouse.download_watermark',
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

/** Bất kỳ quyền nào mở được màn Kho dữ liệu (hub tabbed). */
export const ARCHIVE_DATA_HUB_SCREEN_REQUIREMENTS = [
  ...ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS,
  {
    module: 'archive',
    permissionKey: 'archive.config.manage',
  },
  {
    module: 'archive',
    permissionKey: 'archive.submit',
  },
  {
    module: 'archive',
    permissionKey: 'archive.review',
  },
  {
    module: 'archive.warehouse',
    permissionKey: 'archive.permissions.manage',
  },
  {
    module: 'archive.disposal',
    permissionKey: 'archive.disposal.read',
  },
  {
    module: 'archive.disposal',
    permissionKey: 'archive.disposal.create',
  },
  {
    module: 'archive.disposal',
    permissionKey: 'archive.disposal.update',
  },
  {
    module: 'archive.disposal',
    permissionKey: 'archive.disposal.submit',
  },
] as const satisfies Array<ScreenPermissionRequirement>

/** Drill-down / URL cũ vẫn thuộc phạm vi hub (sidebar path gate). */
export const ARCHIVE_DATA_HUB_RELATED_PATHS = [
  '/app/archive-warehouse',
  '/app/archive-dossiers',
  '/app/archive-submission',
  '/app/archive-review',
  '/app/archive-config',
  '/app/archive-permission',
] as const

/** Toàn bộ path thuộc menu Quản lý kho (landing + kho vật lý + kho dữ liệu). */
export const WAREHOUSE_MANAGEMENT_RELATED_PATHS = [
  '/app/warehouse-management',
  '/app/physical-warehouse',
  ...ARCHIVE_DATA_HUB_RELATED_PATHS,
] as const

const LEGACY_MANAGE_IMPLIES = new Set<string>([
  ARCHIVE_WAREHOUSE_PERMISSIONS.edit,
  ARCHIVE_WAREHOUSE_PERMISSIONS.delete,
  ARCHIVE_WAREHOUSE_PERMISSIONS.reupload,
])

/** Khớp BE `hasArchiveWarehousePermission`: read→search, manage→edit/delete/reupload. */
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
      'physical-warehouse.item.read',
      'physical-warehouse',
    )
  )
}

export function canDownloadOriginal(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    ARCHIVE_WAREHOUSE_PERMISSIONS.downloadOriginal,
    MODULE,
  )
}

export function canDownloadWatermark(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    ARCHIVE_WAREHOUSE_PERMISSIONS.downloadWatermark,
    MODULE,
  )
}

/**
 * @deprecated Role download_* no longer gates export UI.
 * Use canExportDossiers — original/watermark are enforced by security level on BE.
 */
export function canDownloadAny(permissions: Array<string>): boolean {
  return canExportDossiers(permissions)
}

/** Show download/export actions — matches BE Permission.DOSSIERS_EXPORT. */
export function canExportDossiers(permissions: Array<string>): boolean {
  return isPermissionGranted(permissions, 'dossiers.export', 'dossiers')
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
      'physical-warehouse.item.read',
      'physical-warehouse',
    )
  )
}
