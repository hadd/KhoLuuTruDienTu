import type {
  ArchiveWarehouseBulkDeleteFilesResultT,
  ArchiveWarehouseBulkMoveFilesResultT,
  ArchiveWarehouseDeleteFileResultT,
  ArchiveWarehouseDocumentTypeT,
  ArchiveWarehouseDocumentsByTypeResponseT,
  ArchiveWarehouseDossierDetailT,
  ArchiveWarehouseDossiersByTypeResponseT,
  ArchiveWarehouseDossiersResponseT,
  ArchiveWarehouseDossierTypeSummaryT,
  ArchiveWarehouseDossierTypeT,
  ArchiveWarehouseDocumentTypeSummaryT,
  ArchiveWarehouseFondListItemT,
  ArchiveWarehouseFondSummaryT,
  ArchiveWarehouseMoveFileResultT,
  ArchiveWarehouseReuploadResultT,
  ArchiveWarehouseReuploadUploadPointT,
  ArchiveWarehouseSearchResponseT,
  ArchiveWarehouseUnassignedDossiersResponseT,
  GetArchiveWarehouseDocumentsByDocumentTypeParamsT,
  GetArchiveWarehouseDossiersByDossierTypeParamsT,
  GetArchiveWarehouseDossierTypeSummaryParamsT,
  GetArchiveWarehouseDocumentTypeSummaryParamsT,
  GetArchiveWarehouseUnassignedDossiersParamsT,
  GetArchiveWarehouseDossiersParamsT,
  GetArchiveWarehouseFondSummaryParamsT,
  GetArchiveWarehouseSearchParamsT,
  WarehouseDossierStatusT,
} from '@/features/archive-warehouse/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams, appendQueryValues } from '@/lib/api/query-params'

export async function getArchiveWarehouseFonds(): Promise<{
  items: Array<ArchiveWarehouseFondListItemT>
}> {
  const response = await apiClient.get<{
    items: Array<ArchiveWarehouseFondListItemT>
  }>('/api/v1/archive-warehouse/fonds')
  return response.data
}

export async function getArchiveWarehouseFondSummary(
  params: GetArchiveWarehouseFondSummaryParamsT,
): Promise<ArchiveWarehouseFondSummaryT> {
  const searchParams = new URLSearchParams()
  if (params.status) {
    searchParams.set('status', params.status)
  }
  const queryString = searchParams.toString()
  const response = await apiClient.get<ArchiveWarehouseFondSummaryT>(
    `/api/v1/archive-warehouse/fonds/${encodeURIComponent(params.fondId)}/summary${queryString ? `?${queryString}` : ''}`,
  )
  return response.data
}

export async function getArchiveWarehouseUnassignedDossiers(
  params?: GetArchiveWarehouseUnassignedDossiersParamsT,
): Promise<ArchiveWarehouseUnassignedDossiersResponseT> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
    search: params?.search,
  })
  if (params?.status) {
    searchParams.set('status', params.status)
  }

  const queryString = searchParams.toString()
  const response =
    await apiClient.get<ArchiveWarehouseUnassignedDossiersResponseT>(
      `/api/v1/archive-warehouse/dossiers/unassigned?${queryString}`,
    )
  const data = response.data

  return {
    items: data.items ?? [],
    page: data.page ?? params?.page ?? 1,
    limit: data.limit ?? params?.limit ?? 20,
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
    fondScope: data.fondScope ?? null,
  }
}

export async function getArchiveWarehouseDossiers(
  params: GetArchiveWarehouseDossiersParamsT,
): Promise<ArchiveWarehouseDossiersResponseT> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    search: params.search,
  })
  if (params.fondId) {
    appendQueryValues(searchParams, 'fondId', params.fondId)
  }
  appendQueryValues(searchParams, 'dossierTypeId', params.dossierTypeId)
  if (params.year != null) {
    searchParams.set('year', String(params.year))
  }
  if (params.status) {
    searchParams.set('status', params.status)
  }
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortDir) searchParams.set('sortDir', params.sortDir)

  const queryString = searchParams.toString()
  const response = await apiClient.get<ArchiveWarehouseDossiersResponseT>(
    `/api/v1/archive-warehouse/dossiers?${queryString}`,
  )
  const data = response.data

  return {
    items: data.items ?? [],
    page: data.page ?? params.page ?? 1,
    limit: data.limit ?? params.limit ?? 20,
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
    fondScope: data.fondScope ?? null,
    fondId: data.fondId ?? (Array.isArray(params.fondId) ? null : params.fondId ?? null),
  }
}

export async function getArchiveWarehouseDossiersByDossierType(
  params: GetArchiveWarehouseDossiersByDossierTypeParamsT,
): Promise<ArchiveWarehouseDossiersByTypeResponseT> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    search: params.search,
  })
  searchParams.set('dossierTypeId', params.dossierTypeId)
  if (params.year != null) {
    searchParams.set('year', String(params.year))
  }
  if (params.status) {
    searchParams.set('status', params.status)
  }

  const response = await apiClient.get<ArchiveWarehouseDossiersByTypeResponseT>(
    `/api/v1/archive-warehouse/dossiers/by-dossier-type?${searchParams.toString()}`,
  )
  const data = response.data

  return {
    items: data.items ?? [],
    page: data.page ?? params.page ?? 1,
    limit: data.limit ?? params.limit ?? 20,
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
    fondScope: data.fondScope ?? null,
    dossierTypeId: data.dossierTypeId ?? params.dossierTypeId,
  }
}

export async function getArchiveWarehouseDossierTypeSummary(
  params: GetArchiveWarehouseDossierTypeSummaryParamsT,
): Promise<ArchiveWarehouseDossierTypeSummaryT> {
  const searchParams = new URLSearchParams()
  if (params.status) {
    searchParams.set('status', params.status)
  }
  const queryString = searchParams.toString()
  const response = await apiClient.get<ArchiveWarehouseDossierTypeSummaryT>(
    `/api/v1/archive-warehouse/dossier-types/${encodeURIComponent(params.dossierTypeId)}/summary${queryString ? `?${queryString}` : ''}`,
  )
  return response.data
}

export async function getArchiveWarehouseDocumentsByDocumentType(
  params: GetArchiveWarehouseDocumentsByDocumentTypeParamsT,
): Promise<ArchiveWarehouseDocumentsByTypeResponseT> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    search: params.search,
  })
  searchParams.set('documentTypeId', params.documentTypeId)

  const response =
    await apiClient.get<ArchiveWarehouseDocumentsByTypeResponseT>(
      `/api/v1/archive-warehouse/documents/by-document-type?${searchParams.toString()}`,
    )
  const data = response.data

  return {
    items: data.items ?? [],
    page: data.page ?? params.page ?? 1,
    limit: data.limit ?? params.limit ?? 20,
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
    fondScope: data.fondScope ?? null,
    documentTypeId: data.documentTypeId ?? params.documentTypeId,
  }
}

export async function getArchiveWarehouseDocumentTypeSummary(
  params: GetArchiveWarehouseDocumentTypeSummaryParamsT,
): Promise<ArchiveWarehouseDocumentTypeSummaryT> {
  const response = await apiClient.get<ArchiveWarehouseDocumentTypeSummaryT>(
    `/api/v1/archive-warehouse/document-types/${encodeURIComponent(params.documentTypeId)}/summary`,
  )
  return response.data
}

export async function getArchiveWarehouseDossierDetail(
  dossierId: string,
  _options?: { securityLevelId?: string | null },
): Promise<ArchiveWarehouseDossierDetailT> {
  const response = await apiClient.get<ArchiveWarehouseDossierDetailT>(
    `/api/v1/archive-warehouse/dossiers/${dossierId}`,
    {
      dossierId,
      securityAccessModule: 'warehouse',
      _skipGlobalErrorToast: true,
    },
  )
  return response.data
}

export async function getArchiveWarehouseDossierTypes(): Promise<{
  items: Array<ArchiveWarehouseDossierTypeT>
}> {
  const response = await apiClient.get<{
    items: Array<ArchiveWarehouseDossierTypeT>
  }>('/api/v1/archive-warehouse/dossier-types')
  return response.data
}

export async function getArchiveWarehouseDocumentTypes(): Promise<{
  items: Array<ArchiveWarehouseDocumentTypeT>
}> {
  const response = await apiClient.get<{
    items: Array<ArchiveWarehouseDocumentTypeT>
  }>('/api/v1/archive-warehouse/document-types')
  return response.data
}

export async function searchArchiveWarehouseContent(
  params: GetArchiveWarehouseSearchParamsT,
): Promise<ArchiveWarehouseSearchResponseT> {
  const searchParams = new URLSearchParams()
  const hasQ = Boolean(params.q?.trim())
  const mode = params.mode ?? (hasQ ? 'all' : 'metadata')
  searchParams.set('mode', mode)

  const appendSharedFilters = () => {
    appendQueryValues(searchParams, 'dossierTypeId', params.dossierTypeId)
    appendQueryValues(searchParams, 'documentTypeId', params.documentTypeId)
    if (params.editorName?.trim()) {
      searchParams.set('editorName', params.editorName.trim())
    }
    if (params.searchFields) {
      const fields = Array.isArray(params.searchFields) ? params.searchFields : [params.searchFields]
      fields.forEach((f) => searchParams.append('searchFields', f))
    }
    if (params.editCompletedAtFrom) {
      searchParams.set('editCompletedAtFrom', params.editCompletedAtFrom)
    }
    if (params.editCompletedAtTo) {
      searchParams.set('editCompletedAtTo', params.editCompletedAtTo)
    }
    if (params.archivedAtFrom)
      searchParams.set('archivedAtFrom', params.archivedAtFrom)
    if (params.archivedAtTo)
      searchParams.set('archivedAtTo', params.archivedAtTo)
  }

  if (mode === 'content' || mode === 'all') {
    if (params.q?.trim()) searchParams.set('q', params.q.trim())
    if (params.groupCode) searchParams.set('groupCode', params.groupCode)
    if (params.trangThaiHoSo)
      searchParams.set('trangThaiHoSo', params.trangThaiHoSo)
    appendSharedFilters()
  } else {
    if (params.dossierName?.trim()) {
      searchParams.set('dossierName', params.dossierName.trim())
    } else if (params.q?.trim()) {
      searchParams.set('dossierName', params.q.trim())
    }
    if (params.documentName?.trim()) {
      searchParams.set('documentName', params.documentName.trim())
    }
    appendSharedFilters()
  }

  appendQueryValues(searchParams, 'fondId', params.fondId)
  if (params.limit != null) searchParams.set('limit', String(params.limit))
  if (params.offset != null) searchParams.set('offset', String(params.offset))

  const response = await apiClient.get<ArchiveWarehouseSearchResponseT>(
    `/api/v1/archive-warehouse/search?${searchParams.toString()}`,
  )
  const data = response.data
  return {
    items: data.items ?? [],
    total: data.total ?? 0,
    took_ms: data.took_ms ?? 0,
    fondScope: data.fondScope ?? null,
    message: data.message ?? null,
  }
}

export async function createArchiveWarehouseReuploadUploadPoint(
  dossierId: string,
  fileId: string,
): Promise<ArchiveWarehouseReuploadUploadPointT> {
  const response = await apiClient.post<ArchiveWarehouseReuploadUploadPointT>(
    `/api/v1/archive-warehouse/dossiers/${dossierId}/files/${fileId}/reupload-upload-point`,
  )
  return response.data
}

export async function reuploadArchiveWarehouseFile(
  dossierId: string,
  fileId: string,
  body?: { key?: string },
): Promise<ArchiveWarehouseReuploadResultT> {
  const response = await apiClient.post<ArchiveWarehouseReuploadResultT>(
    `/api/v1/archive-warehouse/dossiers/${dossierId}/files/${fileId}/reupload`,
    body ?? {},
  )
  return response.data
}

export async function deleteArchiveWarehouseFile(
  dossierId: string,
  fileId: string,
): Promise<ArchiveWarehouseDeleteFileResultT> {
  const response = await apiClient.delete<ArchiveWarehouseDeleteFileResultT>(
    `/api/v1/archive-warehouse/dossiers/${dossierId}/files/${fileId}`,
  )
  return response.data
}

export async function deleteArchiveWarehouseFiles(
  dossierId: string,
  fileIds: Array<string>,
): Promise<ArchiveWarehouseBulkDeleteFilesResultT> {
  const response = await apiClient.post<ArchiveWarehouseBulkDeleteFilesResultT>(
    `/api/v1/archive-warehouse/dossiers/${dossierId}/files/bulk-delete`,
    { fileIds },
  )
  return response.data
}

export async function moveArchiveWarehouseFile(
  dossierId: string,
  fileId: string,
  targetDossierId: string,
): Promise<ArchiveWarehouseMoveFileResultT> {
  const response = await apiClient.post<ArchiveWarehouseMoveFileResultT>(
    `/api/v1/archive-warehouse/dossiers/${dossierId}/files/${fileId}/move`,
    { targetDossierId },
  )
  return response.data
}

export async function moveArchiveWarehouseFiles(
  dossierId: string,
  fileIds: Array<string>,
  targetDossierId: string,
): Promise<ArchiveWarehouseBulkMoveFilesResultT> {
  const response = await apiClient.post<ArchiveWarehouseBulkMoveFilesResultT>(
    `/api/v1/archive-warehouse/dossiers/${dossierId}/files/bulk-move`,
    { fileIds, targetDossierId },
  )
  return response.data
}

export async function uploadFileToWarehouseReuploadPoint(
  file: File,
  uploadPoint: ArchiveWarehouseReuploadUploadPointT,
): Promise<string> {
  const baseKey = uploadPoint.prefix.endsWith('/')
    ? uploadPoint.prefix
    : `${uploadPoint.prefix}/`
  const relativePath = file.name
  const storageKey = `${baseKey}${relativePath}`

  const form = new FormData()
  for (const [k, v] of Object.entries(uploadPoint.formData)) {
    if (k === 'key') {
      form.append('key', storageKey)
    } else {
      form.append(k, v)
    }
  }
  form.append('file', file)

  const response = await fetch(uploadPoint.postURL, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
  }

  return response.data
}

export type ArchiveWarehouseSecurityPayloadT = {
  securityLevelId?: string | null
  accessPassword?: string
  clearAccessPassword?: boolean
  currentAccessPassword?: string
}

export async function updateArchiveWarehouseDossierSecurity(
  dossierId: string,
  payload: ArchiveWarehouseSecurityPayloadT,
): Promise<{
  dossier: {
    id: string
    securityLevelId: string | null
    accessPasswordEnabled: boolean
    passwordSource: 'own' | 'security_level' | 'none'
  }
}> {
  const response = await apiClient.patch<{
    dossier: {
      id: string
      securityLevelId: string | null
      accessPasswordEnabled: boolean
      passwordSource: 'own' | 'security_level' | 'none'
    }
  }>(`/api/v1/archive-warehouse/dossiers/${dossierId}/security`, payload)
  return response.data
}

export async function updateArchiveWarehouseFileSecurity(
  dossierId: string,
  fileId: string,
  payload: ArchiveWarehouseSecurityPayloadT,
): Promise<{
  file: {
    id: string
    dossierId: string
    securityLevelId: string | null
    accessPasswordEnabled: boolean
    passwordSource: 'own' | 'security_level' | 'none'
  }
}> {
  const response = await apiClient.patch<{
    file: {
      id: string
      dossierId: string
      securityLevelId: string | null
      accessPasswordEnabled: boolean
      passwordSource: 'own' | 'security_level' | 'none'
    }
  }>(
    `/api/v1/archive-warehouse/dossiers/${dossierId}/files/${fileId}/security`,
    payload,
  )
  return response.data
}

export async function updateArchiveWarehouseFilesSecurity(
  dossierId: string,
  fileIds: Array<string>,
  payload: ArchiveWarehouseSecurityPayloadT,
): Promise<{
  files: Array<{
    id: string
    dossierId: string
    securityLevelId: string | null
    accessPasswordEnabled: boolean
    passwordSource: 'own' | 'security_level' | 'none'
  }>
}> {
  const response = await apiClient.post<{
    files: Array<{
      id: string
      dossierId: string
      securityLevelId: string | null
      accessPasswordEnabled: boolean
      passwordSource: 'own' | 'security_level' | 'none'
    }>
  }>(
    `/api/v1/archive-warehouse/dossiers/${dossierId}/files/bulk-security`,
    { fileIds, ...payload },
  )
  return response.data
}

export async function getArchiveWarehouseFileContent(
  dossierId: string,
  fileId: string,
  options?: {
    variant?: 'searchable' | 'original'
    disposition?: 'inline' | 'attachment'
  },
): Promise<{
  fileId: string
  dossierId: string
  variant: string
  disposition: string
  expiresIn: number
  url: string
}> {
  const searchParams = new URLSearchParams()
  if (options?.variant) searchParams.set('variant', options.variant)
  if (options?.disposition) searchParams.set('disposition', options.disposition)
  const qs = searchParams.toString()
  const response = await apiClient.get<{
    fileId: string
    dossierId: string
    variant: string
    disposition: string
    expiresIn: number
    url: string
  }>(
    `/api/v1/archive-warehouse/dossiers/${dossierId}/files/${fileId}/content${qs ? `?${qs}` : ''}`,
    {
      dossierId,
      securityAccessModule: 'warehouse',
      _skipGlobalErrorToast: true,
    },
  )
  return response.data
}

export const WAREHOUSE_DOSSIER_STATUSES = [
  'ARCHIVED',
] as const satisfies Array<WarehouseDossierStatusT>

export interface SoftDeletedDossierT {
  id: string
  name: string
  fondId: string | null
  deletedAt: string
  updatedAt: string
}

export async function softDeleteWarehouseDossier(dossierId: string): Promise<void> {
  await apiClient.delete(`/api/v1/dossiers/${dossierId}`)
}

export async function listSoftDeletedDossiers(): Promise<SoftDeletedDossierT[]> {
  const response = await apiClient.get<SoftDeletedDossierT[]>('/api/v1/dossiers/soft-deleted')
  return response.data
}

export async function permanentDeleteDossiers(ids: string[]): Promise<{
  deletedIds: string[]
  deletedObjectCount: number
}> {
  const response = await apiClient.post('/api/v1/dossiers/permanent-batch-delete', { ids })
  return response.data
}

export async function restoreWarehouseDossiers(ids: string[]): Promise<{
  restoredIds: string[]
}> {
  const response = await apiClient.post('/api/v1/dossiers/restore-batch', { ids })
  return response.data
}
