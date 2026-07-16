import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

import {
  DOCUMENT_TYPE_CREATE_PERMISSION,
  DOCUMENT_TYPE_DELETE_PERMISSION,
  DOCUMENT_TYPE_UPDATE_PERMISSION,
  DOCUMENT_TYPE_VIEW_PERMISSION,
} from './documentTypeManagementPermissions'

const DOCUMENT_TYPES_MODULE = 'document-types'

export function canViewDocumentTypes(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    DOCUMENT_TYPE_VIEW_PERMISSION,
    DOCUMENT_TYPES_MODULE,
  )
}

export function canCreateDocumentTypes(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    DOCUMENT_TYPE_CREATE_PERMISSION,
    DOCUMENT_TYPES_MODULE,
  )
}

export function canUpdateDocumentTypes(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    DOCUMENT_TYPE_UPDATE_PERMISSION,
    DOCUMENT_TYPES_MODULE,
  )
}

export function canDeleteDocumentTypes(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    DOCUMENT_TYPE_DELETE_PERMISSION,
    DOCUMENT_TYPES_MODULE,
  )
}
