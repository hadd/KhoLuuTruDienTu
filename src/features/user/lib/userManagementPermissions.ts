import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

export const USER_VIEW_PERMISSION = 'users.read'
export const USER_CREATE_PERMISSION = 'users.create'
export const USER_UPDATE_PERMISSION = 'users.update'
export const USER_DELETE_PERMISSION = 'users.delete'
export const USER_IMPORT_PERMISSION = 'users.import'
export const USER_EXPORT_PERMISSION = 'users.export'
export const USER_RESET_PASSWORD_PERMISSION = 'users.reset_password'

export const USER_MANAGE_PERMISSION = getModuleWildcard('users')
