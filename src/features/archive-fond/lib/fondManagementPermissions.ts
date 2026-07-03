import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

export const FOND_VIEW_PERMISSION = 'fonds.read'
export const FOND_CREATE_PERMISSION = 'fonds.create'
export const FOND_UPDATE_PERMISSION = 'fonds.update'
export const FOND_DELETE_PERMISSION = 'fonds.delete'

export const FOND_MANAGE_PERMISSION = getModuleWildcard('fonds')
