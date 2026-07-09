import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

import {
  DOSSIER_TYPE_CREATE_PERMISSION,
  DOSSIER_TYPE_DELETE_PERMISSION,
  DOSSIER_TYPE_UPDATE_PERMISSION,
  DOSSIER_TYPE_VIEW_PERMISSION,
} from './dossierTypeManagementPermissions'

const DOSSIER_TYPES_MODULE = 'dossier-types'

export function canViewDossierTypes(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    DOSSIER_TYPE_VIEW_PERMISSION,
    DOSSIER_TYPES_MODULE,
  )
}

export function canCreateDossierTypes(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    DOSSIER_TYPE_CREATE_PERMISSION,
    DOSSIER_TYPES_MODULE,
  )
}

export function canUpdateDossierTypes(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    DOSSIER_TYPE_UPDATE_PERMISSION,
    DOSSIER_TYPES_MODULE,
  )
}

export function canDeleteDossierTypes(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    DOSSIER_TYPE_DELETE_PERMISSION,
    DOSSIER_TYPES_MODULE,
  )
}
