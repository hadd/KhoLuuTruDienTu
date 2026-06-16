import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { createNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import type {
  CheckerRejectPayloadT,
  CheckerRejectResponseT,
  DataDossierMetadataT,
  MakerClaimT,
} from '@/features/data-management/types'
import { apiClient } from '@/lib/api/apiClient'

const MAKER_CLAIM_PATH = '/api/v1/data-entry/maker/claim'

/** GET /api/v1/data-entry/maker/claim — claim next maker assignment */
export async function claimMakerAssignment(): Promise<MakerClaimT> {
  const response = await apiClient.get<MakerClaimT>(MAKER_CLAIM_PATH, {
    validateStatus: (status) => status === 200 || status === 404,
    _skipGlobalErrorToast: true,
  })

  if (response.status === 404) {
    throw createNoAssignedDossierError()
  }

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
  payload: CheckerRejectPayloadT,
): Promise<CheckerRejectResponseT> {
  const response = await apiClient.post<CheckerRejectResponseT>(
    `/api/v1/data-entry/checker/reject/${dossierId}`,
    payload,
  )
  return response.data
}

/** Route save/approve to the correct BE endpoint by role. */
export async function persistDossierMetadataByRole(
  role: DataManagementRole,
  dossierId: string,
  metadata: DataDossierMetadataT,
): Promise<void> {
  if (role === 'editor') {
    await saveDossierMetadata(dossierId, metadata)
    return
  }

  await approveCheckerDossier(dossierId, metadata)
}
