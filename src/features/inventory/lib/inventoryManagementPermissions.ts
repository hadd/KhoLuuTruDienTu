import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

export const INVENTORY_VIEW_PERMISSION = 'inventories.read'
export const INVENTORY_CREATE_PERMISSION = 'inventories.create'
export const INVENTORY_UPDATE_PERMISSION = 'inventories.update'
export const INVENTORY_DELETE_PERMISSION = 'inventories.delete'

export const INVENTORY_MANAGE_PERMISSION = getModuleWildcard('inventories')
