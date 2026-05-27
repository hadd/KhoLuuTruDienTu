import { apiClient } from '@/lib/api/apiClient'
import type {
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
