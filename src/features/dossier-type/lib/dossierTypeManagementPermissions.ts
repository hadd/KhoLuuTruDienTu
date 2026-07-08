import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

export const DOSSIER_TYPE_VIEW_PERMISSION = 'dossier-types.read'
export const DOSSIER_TYPE_CREATE_PERMISSION = 'dossier-types.create'
export const DOSSIER_TYPE_UPDATE_PERMISSION = 'dossier-types.update'
export const DOSSIER_TYPE_DELETE_PERMISSION = 'dossier-types.delete'

export const DOSSIER_TYPE_MANAGE_PERMISSION = getModuleWildcard('dossier-types')
