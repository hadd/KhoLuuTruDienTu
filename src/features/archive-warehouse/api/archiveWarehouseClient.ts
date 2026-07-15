import type { ArchiveFondT } from '@/features/archive-fond/types'
import type {
  ArchiveWarehouseDeleteFileResultT,
  ArchiveWarehouseDossierDetailT,
  ArchiveWarehouseDossierTypeT,
  ArchiveWarehouseDossiersResponseT,
  ArchiveWarehouseFondSummaryT,
  ArchiveWarehouseMoveFileResultT,
  ArchiveWarehouseReuploadResultT,
  ArchiveWarehouseReuploadUploadPointT,
  ArchiveWarehouseSearchResponseT,
  GetArchiveWarehouseDossiersParamsT,
  GetArchiveWarehouseFondSummaryParamsT,
  GetArchiveWarehouseSearchParamsT,
  WarehouseDossierStatusT,
} from '@/features/archive-warehouse/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'

export async function getArchiveWarehouseFonds(): Promise<{
  items: Array<ArchiveFondT>
}> {
  const response = await apiClient.get<{ items: Array<ArchiveFondT> }>(
    '/api/v1/archive-warehouse/fonds',
  )
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

export async function getArchiveWarehouseDossiers(
  params: GetArchiveWarehouseDossiersParamsT,
): Promise<ArchiveWarehouseDossiersResponseT> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    search: params.search,
  })
  searchParams.set('fondId', params.fondId)
  if (params.year != null) {
    searchParams.set('year', String(params.year))
  }
  if (params.status) {
    searchParams.set('status', params.status)
  }

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
    fondId: data.fondId ?? params.fondId,
  }
}

export async function getArchiveWarehouseDossierDetail(
  dossierId: string,
): Promise<ArchiveWarehouseDossierDetailT> {
  const response = await apiClient.get<ArchiveWarehouseDossierDetailT>(
    `/api/v1/archive-warehouse/dossiers/${dossierId}`,
  )
  return response.data
}

export async function getArchiveWarehouseDossierTypes(): Promise<{
  items: Array<ArchiveWarehouseDossierTypeT>
}> {
  const response = await apiClient.get<{ items: Array<ArchiveWarehouseDossierTypeT> }>(
    '/api/v1/archive-warehouse/dossier-types',
  )
  return response.data
}

export async function searchArchiveWarehouseContent(
  params: GetArchiveWarehouseSearchParamsT,
): Promise<ArchiveWarehouseSearchResponseT> {
  const searchParams = new URLSearchParams()
  const mode = params.mode ?? (params.q?.trim() && !params.dossierName ? 'content' : 'metadata')
  searchParams.set('mode', mode)

  if (mode === 'content') {
    if (params.q?.trim()) searchParams.set('q', params.q.trim())
    if (params.groupCode) searchParams.set('groupCode', params.groupCode)
    if (params.trangThaiHoSo) searchParams.set('trangThaiHoSo', params.trangThaiHoSo)
  } else {
    if (params.dossierName?.trim()) {
      searchParams.set('dossierName', params.dossierName.trim())
    } else if (params.q?.trim()) {
      searchParams.set('dossierName', params.q.trim())
    }
    if (params.documentName?.trim()) {
      searchParams.set('documentName', params.documentName.trim())
    }
    if (params.dossierTypeId) searchParams.set('dossierTypeId', params.dossierTypeId)
    if (params.editorName?.trim()) {
      searchParams.set('editorName', params.editorName.trim())
    }
    if (params.editCompletedAtFrom) {
      searchParams.set('editCompletedAtFrom', params.editCompletedAtFrom)
    }
    if (params.editCompletedAtTo) {
      searchParams.set('editCompletedAtTo', params.editCompletedAtTo)
    }
    if (params.archivedAtFrom) searchParams.set('archivedAtFrom', params.archivedAtFrom)
    if (params.archivedAtTo) searchParams.set('archivedAtTo', params.archivedAtTo)
  }

  if (params.fondId) searchParams.set('fondId', params.fondId)
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

  return storageKey
}

export const WAREHOUSE_DOSSIER_STATUSES = ['ARCHIVED'] as const satisfies Array<
  WarehouseDossierStatusT
>
