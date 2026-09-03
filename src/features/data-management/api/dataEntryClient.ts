import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { createNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import { extractDossierMetadataPayload } from '@/features/data-management/lib/metadataHelpers'
import type {
  CheckerRejectPayloadT,
  CheckerRejectResponseT,
  DataDossierMetadataT,
  DossierIssueReportT,
  MakerClaimT,
  SaveDossierMetadataResultT,
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

/** GET /api/v1/data-entry/maker/dossiers/:dossierId — claim payload for one dossier */
export async function getMakerAssignmentForDossier(
  dossierId: string,
): Promise<MakerClaimT | null> {
  const response = await apiClient.get<MakerClaimT>(
    `/api/v1/data-entry/maker/dossiers/${encodeURIComponent(dossierId)}`,
    {
      validateStatus: (status) => status === 200 || status === 404,
      _skipGlobalErrorToast: true,
    },
  )

  if (response.status === 404) {
    return null
  }

  return response.data
}

/** PUT /api/v1/folders/dossiers/:dossierId/metadata — save dossier metadata JSON */
export async function saveDossierMetadata(
  dossierId: string,
  metadata: DataDossierMetadataT,
): Promise<SaveDossierMetadataResultT> {
  const response = await apiClient.put<SaveDossierMetadataResultT>(
    `/api/v1/folders/dossiers/${dossierId}/metadata`,
    { metadata },
  )
  return response.data
}

/** PUT /api/v1/folders/dossiers/:dossierId/metadata — save metadata with editor issue report */
export async function saveDossierMetadataWithIssueReport(
  dossierId: string,
  metadata: DataDossierMetadataT,
  issueReport: DossierIssueReportT,
): Promise<void> {
  await apiClient.put(`/api/v1/folders/dossiers/${dossierId}/metadata`, {
    metadata,
    issue_report: issueReport,
  })
}

/** PUT /api/v1/dossiers/:dossierId/metadata/draft — save editor draft metadata */
export async function saveDossierMetadataDraft(
  dossierId: string,
  metadata: DataDossierMetadataT,
): Promise<void> {
  await apiClient.put(
    `/api/v1/dossiers/${encodeURIComponent(dossierId)}/metadata/draft`,
    { metadata },
  )
}

/** Load editor draft metadata via authenticated API (avoids browser CORS to MinIO). */
export async function getEditorDraftMetadataFromApi(
  dossierId: string,
): Promise<DataDossierMetadataT | undefined> {
  const requests = [
    apiClient.get<unknown>(
      `/api/v1/dossiers/${encodeURIComponent(dossierId)}/metadata/draft`,
      {
        validateStatus: (status) => status === 200 || status === 404,
        _skipGlobalErrorToast: true,
      },
    ),
    apiClient.get<unknown>(
      `/api/v1/folders/dossiers/${encodeURIComponent(dossierId)}/metadata`,
      {
        params: { status: 'draft' },
        validateStatus: (status) => status === 200 || status === 404,
        _skipGlobalErrorToast: true,
      },
    ),
  ]

  for (const request of requests) {
    const response = await request
    if (response.status !== 200) continue
    const metadata = extractDossierMetadataPayload(response.data)
    if (metadata) return metadata
  }

  return undefined
}

/** POST /api/v1/data-entry/maker/direct-edit/:dossierId — Maker direct edit dossier metadata */
export async function submitDirectEditDossierMetadata(
  dossierId: string,
  metadata: DataDossierMetadataT | Record<string, unknown>,
  issueReport?: IssueReportInputT,
): Promise<SaveDossierMetadataResultT> {
  const response = await apiClient.post<SaveDossierMetadataResultT>(
    `/api/v1/data-entry/maker/direct-edit/${dossierId}`,
    { metadata, issue_report: issueReport },
  )
  return response.data
}

/** POST /api/v1/data-entry/checker/approve/:dossierId — QC approve dossier metadata */
export async function approveCheckerDossier(
  dossierId: string,
  metadata: DataDossierMetadataT | Record<string, unknown>,
): Promise<SaveDossierMetadataResultT> {
  const response = await apiClient.post<SaveDossierMetadataResultT>(
    `/api/v1/data-entry/checker/approve/${dossierId}`,
    { metadata },
  )
  return response.data
}

/** PUT /api/v1/folders/dossiers/:dossierId/metadata/summary — save root summary only */
export async function saveDossierSummaryMetadata(
  dossierId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await apiClient.put(
    `/api/v1/folders/dossiers/${encodeURIComponent(dossierId)}/metadata/summary`,
    { metadata },
  )
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
  options?: {
    isDraft?: boolean
    saveMode?: 'approve' | 'summary' | 'direct_edit'
    storagePayload?: Record<string, unknown>
  },
): Promise<SaveDossierMetadataResultT | void> {
  const payload =
    options?.storagePayload ??
    (metadata as unknown as Record<string, unknown>)

  if (options?.saveMode === 'direct_edit') {
    return await submitDirectEditDossierMetadata(dossierId, payload)
  }

  if (role === 'editor') {
    if (options?.isDraft) {
      await saveDossierMetadataDraft(dossierId, metadata)
      return
    }
    return await saveDossierMetadata(dossierId, metadata)
  }

  if (options?.saveMode === 'summary') {
    await saveDossierSummaryMetadata(dossierId, payload)
    return
  }

  return await approveCheckerDossier(dossierId, payload)
}
