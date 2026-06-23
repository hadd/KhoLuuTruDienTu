import { getEditorDraftMetadataFromApi } from '@/features/data-management/api/dataEntryClient'
import {
  fetchDossierMetadata,
  resolveMetadataUrl,
} from '@/features/data-management/lib/metadataHelpers'
import type { MakerClaimT } from '@/features/data-management/types'
import type {
  EditorDraftAssignmentsResponseT,
  EditorDraftDossierT,
  EditorDraftFilesResponseT,
  EditorDraftSubmitPayloadT,
  EditorDraftSubmitResultT,
} from '@/features/editor-dossiers/types'
import { apiClient } from '@/lib/api/apiClient'

const DRAFT_ASSIGNMENTS_PATH = '/api/v1/dossiers/assignments/drafts'
const DRAFT_SUBMIT_PATH = '/api/v1/dossiers/assignments/drafts/submit'

function mapAssignmentToDraftDossier(
  assignment: EditorDraftAssignmentsResponseT['assignments'][number],
): EditorDraftDossierT {
  return {
    assignmentId: assignment.id,
    dossierId: assignment.dossier.id,
    name: assignment.dossier.name,
    assignedAt: assignment.assignedAt,
    updatedAt: assignment.dossier.updatedAt,
    currentMetadataUrl: assignment.currentMetadataUrl,
  }
}

/** GET /api/v1/dossiers/assignments/drafts */
export async function getEditorDraftDossiers(): Promise<Array<EditorDraftDossierT>> {
  const response = await apiClient.get<EditorDraftAssignmentsResponseT>(
    DRAFT_ASSIGNMENTS_PATH,
  )
  return (response.data.assignments ?? []).map(mapAssignmentToDraftDossier)
}

/** GET /api/v1/folders/dossiers/:dossierId/files?status=draft */
export async function getEditorDraftFiles(
  dossierId: string,
): Promise<EditorDraftFilesResponseT> {
  const response = await apiClient.get<EditorDraftFilesResponseT>(
    `/api/v1/folders/dossiers/${encodeURIComponent(dossierId)}/files`,
    { params: { status: 'draft' } },
  )
  return response.data
}

function uniqueMetadataUrls(
  ...sources: Array<string | null | undefined>
): Array<string> {
  const urls: Array<string> = []
  for (const source of sources) {
    const url = resolveMetadataUrl(source)
    if (url && !urls.includes(url)) {
      urls.push(url)
    }
  }
  return urls
}

/** Best-effort draft metadata load for list-page submit (API first, then presigned URL). */
async function loadEditorDraftMetadata(
  dossierId: string,
  draftRow?: EditorDraftDossierT,
): Promise<EditorDraftSubmitPayloadT['items'][number]['metadata']> {
  const fromApi = await getEditorDraftMetadataFromApi(dossierId)
  if (fromApi) return fromApi

  const draftFiles = await getEditorDraftFiles(dossierId)
  const metadataUrls = uniqueMetadataUrls(
    draftFiles.currentMetadataUrl,
    draftRow?.currentMetadataUrl,
  )

  for (const metadataUrl of metadataUrls) {
    const metadata = await fetchDossierMetadata(metadataUrl)
    if (metadata) return metadata
  }

  return undefined
}

export async function buildEditorClaimFromDraftDossier(
  dossierId: string,
  dossierName?: string,
): Promise<MakerClaimT | null> {
  const [draftFiles, draftDossiers] = await Promise.all([
    getEditorDraftFiles(dossierId),
    getEditorDraftDossiers(),
  ])

  const draftRow = draftDossiers.find((item) => item.dossierId === dossierId)
  const assignment = draftFiles.assignment
  const metadataUrl = resolveMetadataUrl(
    draftFiles.currentMetadataUrl,
    draftRow?.currentMetadataUrl,
  )
  const metadata = metadataUrl
    ? await fetchDossierMetadata(metadataUrl)
    : undefined

  return {
    assignment: {
      id: assignment?.id ?? draftRow?.assignmentId ?? `draft-${dossierId}`,
      dossierId,
      role: assignment?.role ?? 'MAKER',
      attemptNumber: 1,
      status: assignment?.status ?? 'DRAFT',
    },
    dossier: {
      id: dossierId,
      name: dossierName ?? draftRow?.name ?? metadata?.ho_so_id ?? dossierId,
      status: assignment?.status ?? 'DRAFT',
    },
    files: (draftFiles.children ?? []).map((file) => ({
      id: file.id,
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      searchablePdfUrl: file.searchablePdfUrl,
    })),
    currentMetadataUrl: metadataUrl ?? null,
    currentMetadata: metadata ?? null,
  }
}

async function buildSubmitItems(
  dossierIds: Array<string>,
  draftDossiers: Array<EditorDraftDossierT>,
): Promise<EditorDraftSubmitPayloadT['items']> {
  const draftById = new Map(
    draftDossiers.map((dossier) => [dossier.dossierId, dossier]),
  )

  const items = await Promise.all(
    dossierIds.map(async (dossierId) => {
      const metadata = await loadEditorDraftMetadata(
        dossierId,
        draftById.get(dossierId),
      )
      return metadata ? { dossierId, metadata } : { dossierId }
    }),
  )

  return items
}

/** POST /api/v1/dossiers/assignments/drafts/submit */
export async function submitEditorDraftFinalSave(
  dossierIds: Array<string>,
): Promise<EditorDraftSubmitResultT> {
  const draftDossiers = await getEditorDraftDossiers()
  const items = await buildSubmitItems(dossierIds, draftDossiers)
  return submitEditorDraftFinalSaveItems(items)
}

/** POST /api/v1/dossiers/assignments/drafts/submit — with explicit metadata payload */
export async function submitEditorDraftFinalSaveItems(
  items: EditorDraftSubmitPayloadT['items'],
): Promise<EditorDraftSubmitResultT> {
  const response = await apiClient.post<EditorDraftSubmitResultT>(
    DRAFT_SUBMIT_PATH,
    { items } satisfies EditorDraftSubmitPayloadT,
  )
  return response.data
}
