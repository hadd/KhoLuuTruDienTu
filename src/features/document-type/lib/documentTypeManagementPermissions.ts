import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

export const DOCUMENT_TYPE_VIEW_PERMISSION = 'document-types.read'
export const DOCUMENT_TYPE_CREATE_PERMISSION = 'document-types.create'
export const DOCUMENT_TYPE_UPDATE_PERMISSION = 'document-types.update'
export const DOCUMENT_TYPE_DELETE_PERMISSION = 'document-types.delete'

export const DOCUMENT_TYPE_MANAGE_PERMISSION = getModuleWildcard('document-types')
