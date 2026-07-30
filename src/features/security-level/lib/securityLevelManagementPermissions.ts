import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

export const SECURITY_LEVEL_VIEW_PERMISSION = 'security-levels.read'
export const SECURITY_LEVEL_CREATE_PERMISSION = 'security-levels.create'
export const SECURITY_LEVEL_UPDATE_PERMISSION = 'security-levels.update'
export const SECURITY_LEVEL_DELETE_PERMISSION = 'security-levels.delete'
export const SECURITY_LEVEL_CONFIG_PERMISSION = 'security-levels.config'

export const SECURITY_PERMISSION_DEF_VIEW_PERMISSION =
  'security-levels.permission-defs.read'
export const SECURITY_PERMISSION_DEF_MANAGE_PERMISSION =
  'security-levels.permission-defs.manage'

export const SECURITY_LEVEL_MANAGE_PERMISSION =
  getModuleWildcard('security-levels')
