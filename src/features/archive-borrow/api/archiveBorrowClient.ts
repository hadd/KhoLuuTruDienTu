import { apiClient } from '@/lib/api/apiClient'

import type {
  ApproveArchiveBorrowInputT,
  ArchiveBorrowDossierMetadataT,
  ArchiveBorrowEligibleDossierT,
  ArchiveBorrowRequestT,
  ArchiveBorrowViewModelT,
  CreateArchiveBorrowInputT,
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

export async function getMyArchiveBorrowRequests(params?: {
  limit?: number
  offset?: number
}): Promise<Array<ArchiveBorrowRequestT>> {
  const search = new URLSearchParams()
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.offset != null) search.set('offset', String(params.offset))
  const qs = search.toString()
  const response = await apiClient.get<Array<ArchiveBorrowRequestT>>(
    `/api/v1/archive-borrow-requests/mine${qs ? `?${qs}` : ''}`,
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