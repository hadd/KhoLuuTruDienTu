export const ARCHIVE_WAREHOUSE_PERMISSION_KEYS = [
  'archive.warehouse.search',
  'archive.warehouse.read',
  'archive.warehouse.manage',
] as const

export type ArchiveWarehousePermissionKeyT =
  (typeof ARCHIVE_WAREHOUSE_PERMISSION_KEYS)[number]
