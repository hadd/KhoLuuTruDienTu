import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

export const DOSSIER_METADATA_SUMMARY_EDIT_PERMISSION =
  'dossiers.metadata.summary.edit'

const DOSSIERS_MODULE = 'dossiers'

export function canEditDossierMetadataSummary(
  permissions: Array<string>,
): boolean {
  return isPermissionGranted(
    permissions,
    DOSSIER_METADATA_SUMMARY_EDIT_PERMISSION,
    DOSSIERS_MODULE,
  )
}
