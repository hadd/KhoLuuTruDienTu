import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

export const SECURITY_LEVEL_VIEW_PERMISSION = 'security-levels.read'
export const SECURITY_LEVEL_CREATE_PERMISSION = 'security-levels.create'
export const SECURITY_LEVEL_UPDATE_PERMISSION = 'security-levels.update'
export const SECURITY_LEVEL_DELETE_PERMISSION = 'security-levels.delete'

export const SECURITY_LEVEL_MANAGE_PERMISSION =
  getModuleWildcard('security-levels')
