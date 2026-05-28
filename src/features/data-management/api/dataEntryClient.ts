import { apiClient } from '@/lib/api/apiClient'
import type {
  CheckerRejectResponseT,
  DataDossierMetadataT,
  MakerClaimT,
} from '@/features/data-management/types'

/** GET /api/v1/data-entry/maker/claim — claim next maker assignment */
export async function claimMakerAssignment(): Promise<MakerClaimT> {
  const response = await apiClient.get<MakerClaimT>(
    '/api/v1/data-entry/maker/claim',
  )
  return response.data
}

/** PUT /api/v1/folders/dossiers/:dossierId/metadata — save dossier metadata JSON */
export async function saveDossierMetadata(
  dossierId: string,
  metadata: DataDossierMetadataT,
): Promise<void> {
  await apiClient.put(`/api/v1/folders/dossiers/${dossierId}/metadata`, {
    metadata,
  })
}

/** POST /api/v1/data-entry/checker/approve/:dossierId — QC approve dossier metadata */
export async function approveCheckerDossier(
  dossierId: string,
  metadata: DataDossierMetadataT,
): Promise<void> {
  await apiClient.post(`/api/v1/data-entry/checker/approve/${dossierId}`, {
    metadata,
  })
}

/** POST /api/v1/data-entry/checker/reject/:dossierId — QC reject dossier */
export async function rejectCheckerDossier(
  dossierId: string,
  notes: string,
): Promise<CheckerRejectResponseT> {
  const response = await apiClient.post<CheckerRejectResponseT>(
    `/api/v1/data-entry/checker/reject/${dossierId}`,
    { notes },
  )
  return response.data
}
