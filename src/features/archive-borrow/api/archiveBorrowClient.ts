import { apiClient } from '@/lib/api/apiClient'

import type {
  ApproveArchiveBorrowInputT,
  ArchiveBorrowAnnotationT,
  ArchiveBorrowDossierMetadataT,
  ArchiveBorrowEligibleDossierT,
  ArchiveBorrowMineListParamsT,
  ArchiveBorrowReviewListParamsT,
  ArchiveBorrowReadingProgressT,
  ArchiveBorrowReadingSummaryT,
  ArchiveBorrowRequestListT,
  ArchiveBorrowRequestT,
  ArchiveBorrowViewModelT,
  CreateArchiveBorrowAnnotationInputT,
  CreateArchiveBorrowInputT,
  UpdateArchiveBorrowAnnotationInputT,
} from '@/features/archive-borrow/types'

export async function createArchiveBorrowRequest(
  input: CreateArchiveBorrowInputT,
): Promise<ArchiveBorrowRequestT> {
  const response = await apiClient.post<ArchiveBorrowRequestT>(
    '/api/v1/archive-borrow-requests',
    input,
  )
  return response.data
}

export async function searchArchiveBorrowEligibleDossiers(params: {
  q: string
  limit?: number
}): Promise<Array<ArchiveBorrowEligibleDossierT>> {
  const search = new URLSearchParams()
  search.set('q', params.q)
  if (params.limit != null) search.set('limit', String(params.limit))
  const response = await apiClient.get<Array<ArchiveBorrowEligibleDossierT>>(
    `/api/v1/archive-borrow-requests/search-dossiers?${search.toString()}`,
  )
  return response.data
}

export async function getMyArchiveBorrowRequests(
  params?: ArchiveBorrowMineListParamsT,
): Promise<ArchiveBorrowRequestListT> {
  const search = new URLSearchParams()
  if (params?.page != null) search.set('page', String(params.page))
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.search) search.set('search', params.search)
  const qs = search.toString()
  const response = await apiClient.get<ArchiveBorrowRequestListT>(
    `/api/v1/archive-borrow-requests/mine${qs ? `?${qs}` : ''}`,
  )
  return response.data
}

export async function getArchiveBorrowReadingSummary(): Promise<ArchiveBorrowReadingSummaryT> {
  const response = await apiClient.get<ArchiveBorrowReadingSummaryT>(
    '/api/v1/archive-borrow-requests/mine/reading-summary',
  )
  return response.data
}

export async function getReviewArchiveBorrowRequests(
  params?: ArchiveBorrowReviewListParamsT,
): Promise<ArchiveBorrowRequestListT> {
  const search = new URLSearchParams()
  if (params?.page != null) search.set('page', String(params.page))
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.search) search.set('search', params.search)
  if (params?.status) search.set('status', params.status)
  const qs = search.toString()
  const response = await apiClient.get<ArchiveBorrowRequestListT>(
    `/api/v1/archive-borrow-requests/review${qs ? `?${qs}` : ''}`,
  )
  return response.data
}

export async function getPendingArchiveBorrowRequests(params?: {
  limit?: number
  offset?: number
}): Promise<Array<ArchiveBorrowRequestT>> {
  const search = new URLSearchParams()
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.offset != null) search.set('offset', String(params.offset))
  const qs = search.toString()
  const response = await apiClient.get<Array<ArchiveBorrowRequestT>>(
    `/api/v1/archive-borrow-requests/pending${qs ? `?${qs}` : ''}`,
  )
  return response.data
}

export async function getArchiveBorrowRequest(
  id: string,
): Promise<ArchiveBorrowRequestT> {
  const response = await apiClient.get<ArchiveBorrowRequestT>(
    `/api/v1/archive-borrow-requests/${id}`,
  )
  return response.data
}

export async function approveArchiveBorrowRequest(
  id: string,
  input: ApproveArchiveBorrowInputT,
): Promise<ArchiveBorrowRequestT> {
  const response = await apiClient.post<ArchiveBorrowRequestT>(
    `/api/v1/archive-borrow-requests/${id}/approve`,
    input,
  )
  return response.data
}

export async function rejectArchiveBorrowRequest(
  id: string,
  reviewNotes: string,
): Promise<ArchiveBorrowRequestT> {
  const response = await apiClient.post<ArchiveBorrowRequestT>(
    `/api/v1/archive-borrow-requests/${id}/reject`,
    { reviewNotes },
  )
  return response.data
}

export async function activateArchiveBorrowRequest(
  id: string,
): Promise<ArchiveBorrowRequestT> {
  const response = await apiClient.post<ArchiveBorrowRequestT>(
    `/api/v1/archive-borrow-requests/${id}/activate`,
  )
  return response.data
}

export async function regenerateArchiveBorrowDip(
  id: string,
  input?: { placementId?: string },
): Promise<ArchiveBorrowRequestT> {
  const response = await apiClient.post<ArchiveBorrowRequestT>(
    `/api/v1/archive-borrow-requests/${id}/regenerate-dip`,
    input ?? {},
  )
  return response.data
}

export async function getArchiveBorrowViewModel(
  id: string,
): Promise<ArchiveBorrowViewModelT> {
  const response = await apiClient.get<ArchiveBorrowViewModelT>(
    `/api/v1/archive-borrow-requests/${id}/view-model`,
  )
  return response.data
}

export async function getArchiveBorrowDossierMetadata(
  id: string,
  dossierId: string,
): Promise<ArchiveBorrowDossierMetadataT> {
  const response = await apiClient.get<ArchiveBorrowDossierMetadataT>(
    `/api/v1/archive-borrow-requests/${id}/dossiers/${dossierId}/metadata`,
  )
  return response.data
}

export async function getArchiveBorrowReadingProgress(
  id: string,
  fileId?: string,
): Promise<Array<ArchiveBorrowReadingProgressT>> {
  const search = new URLSearchParams()
  if (fileId) search.set('fileId', fileId)
  const qs = search.toString()
  const response = await apiClient.get<Array<ArchiveBorrowReadingProgressT>>(
    `/api/v1/archive-borrow-requests/${id}/reading-progress${qs ? `?${qs}` : ''}`,
  )
  return response.data
}

export async function upsertArchiveBorrowReadingProgress(
  id: string,
  input: { fileId: string; page: number },
): Promise<ArchiveBorrowReadingProgressT> {
  const response = await apiClient.put<ArchiveBorrowReadingProgressT>(
    `/api/v1/archive-borrow-requests/${id}/reading-progress`,
    input,
  )
  return response.data
}

export async function getArchiveBorrowAnnotations(
  id: string,
  params?: { fileId?: string; kind?: string },
): Promise<Array<ArchiveBorrowAnnotationT>> {
  const search = new URLSearchParams()
  if (params?.fileId) search.set('fileId', params.fileId)
  if (params?.kind) search.set('kind', params.kind)
  const qs = search.toString()
  const response = await apiClient.get<Array<ArchiveBorrowAnnotationT>>(
    `/api/v1/archive-borrow-requests/${id}/annotations${qs ? `?${qs}` : ''}`,
  )
  return response.data
}

export async function createArchiveBorrowAnnotation(
  id: string,
  input: CreateArchiveBorrowAnnotationInputT,
): Promise<ArchiveBorrowAnnotationT> {
  const response = await apiClient.post<ArchiveBorrowAnnotationT>(
    `/api/v1/archive-borrow-requests/${id}/annotations`,
    input,
  )
  return response.data
}

export async function updateArchiveBorrowAnnotation(
  id: string,
  annotationId: string,
  input: UpdateArchiveBorrowAnnotationInputT,
): Promise<ArchiveBorrowAnnotationT> {
  const response = await apiClient.patch<ArchiveBorrowAnnotationT>(
    `/api/v1/archive-borrow-requests/${id}/annotations/${annotationId}`,
    input,
  )
  return response.data
}

export async function deleteArchiveBorrowAnnotation(
  id: string,
  annotationId: string,
): Promise<{ id: string }> {
  const response = await apiClient.delete<{ id: string }>(
    `/api/v1/archive-borrow-requests/${id}/annotations/${annotationId}`,
  )
  return response.data
}
