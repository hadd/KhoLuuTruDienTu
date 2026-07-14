import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

export const PHYSICAL_WAREHOUSE_ITEM_READ_PERMISSION =
  'physical-warehouse.item.read'
export const PHYSICAL_WAREHOUSE_ITEM_MANAGE_PERMISSION =
  'physical-warehouse.item.manage'
export const PHYSICAL_WAREHOUSE_CONFIG_MANAGE_PERMISSION =
  'physical-warehouse.config.manage'

export const PHYSICAL_WAREHOUSE_MANAGE_PERMISSION = getModuleWildcard(
  'physical-warehouse',
)
