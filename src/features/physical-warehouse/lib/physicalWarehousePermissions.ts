import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

export const PHYSICAL_WAREHOUSE_ITEM_READ_PERMISSION =
  'physical-warehouse.item.read'
export const PHYSICAL_WAREHOUSE_LOCATION_MANAGE_PERMISSION =
  'physical-warehouse.location.manage'
export const PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE_PERMISSION =
  'physical-warehouse.warehouse.manage'

/** Legacy — vẫn chấp nhận trong role cũ, đã gộp vào item.read. */
export const LEGACY_PHYSICAL_WAREHOUSE_ITEM_MANAGE_PERMISSION =
  'physical-warehouse.item.manage'

export const PHYSICAL_WAREHOUSE_MANAGE_PERMISSION = getModuleWildcard(
  'physical-warehouse',
)

export const PHYSICAL_WAREHOUSE_LOCATION_MANAGE_PERMISSIONS = [
  PHYSICAL_WAREHOUSE_LOCATION_MANAGE_PERMISSION,
] as const

export const PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE_PERMISSIONS = [
  PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE_PERMISSION,
] as const

export const PHYSICAL_WAREHOUSE_CONTENTS_PERMISSIONS = [
  PHYSICAL_WAREHOUSE_ITEM_READ_PERMISSION,
  LEGACY_PHYSICAL_WAREHOUSE_ITEM_MANAGE_PERMISSION,
] as const
