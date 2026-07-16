import type { ArchiveFieldConfigT } from '@/features/archive-config/types'
import type {
  ArchiveDossierListItemT,
  ArchiveSubmissionT,
  GetArchiveDossiersParamsT,
  RejectArchivePayloadT,
  SubmitArchivePayloadT,
} from '@/features/archive-submission/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import type { PaginatedResponse } from '@/types/api'

export async function getArchiveDossiers(
  params?: GetArchiveDossiersParamsT,
): Promise<PaginatedResponse<ArchiveDossierListItemT>> {
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
  const response = await apiClient.get<PaginatedResponse<ArchiveDossierListItemT>>(
    `/api/v1/archive-submissions/dossiers${queryString ? `?${queryString}` : ''}`,
  )
  const data = response.data

  return {
    items: data.items ?? [],
    page: data.page ?? params?.page ?? 1,
    limit: data.limit ?? params?.limit ?? 20,
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
  }
}

export async function getActiveArchiveFieldConfigs(): Promise<Array<ArchiveFieldConfigT>> {
  const response = await apiClient.get<{ items: Array<ArchiveFieldConfigT> }>(
    '/api/v1/archive-submissions/field-configs',
  )
  return response.data.items
}

export async function submitArchiveSubmission(
  dossierId: string,
  payload: SubmitArchivePayloadT,
): Promise<ArchiveSubmissionT> {
  const response = await apiClient.post<{ record: ArchiveSubmissionT }>(
    `/api/v1/archive-submissions/dossier/${dossierId}`,
    payload,
  )
  return response.data.record
}

export async function getPendingArchiveSubmissions(params?: {
  page?: number
  limit?: number
}): Promise<PaginatedResponse<ArchiveSubmissionT>> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
  })
  const queryString = searchParams.toString()
  const response = await apiClient.get<PaginatedResponse<ArchiveSubmissionT>>(
    `/api/v1/archive-submissions/pending${queryString ? `?${queryString}` : ''}`,
  )
  return response.data
}

export async function getArchiveSubmission(id: string): Promise<ArchiveSubmissionT> {
  const response = await apiClient.get<{ record: ArchiveSubmissionT }>(
    `/api/v1/archive-submissions/${id}`,
  )
  return response.data.record
}

export async function approveArchiveSubmission(id: string): Promise<ArchiveSubmissionT> {
  const response = await apiClient.post<{ record: ArchiveSubmissionT }>(
    `/api/v1/archive-submissions/${id}/approve`,
  )
  return response.data.record
}

export async function rejectArchiveSubmission(
  id: string,
  payload: RejectArchivePayloadT,
): Promise<ArchiveSubmissionT> {
  const response = await apiClient.post<{ record: ArchiveSubmissionT }>(
    `/api/v1/archive-submissions/${id}/reject`,
    payload,
  )
  return response.data.record
}

export async function getArchiveSubmissionsByDossier(
  dossierId: string,
): Promise<Array<ArchiveSubmissionT>> {
  const response = await apiClient.get<{ items: Array<ArchiveSubmissionT> }>(
    `/api/v1/archive-submissions/dossier/${dossierId}`,
  )
  return response.data.items
}

export async function getArchivePhysicalLocationLevels() {
  const response = await apiClient.get<{
    levels: Array<{
      id: string
      levelName: string
      levelOrder: number
    }>
  }>('/api/v1/archive-submissions/physical-location/levels')
  return response.data.levels
}

export async function getArchivePhysicalLocationItems(params?: {
  parentId?: string
  availableOnly?: boolean
}) {
  const searchParams = new URLSearchParams()
  if (params?.parentId) searchParams.set('parentId', params.parentId)
  if (params?.availableOnly) searchParams.set('availableOnly', 'true')
  const query = searchParams.toString()
  const response = await apiClient.get<{
    items: Array<import('@/features/physical-warehouse/types').PhysicalWarehouseItemT>
  }>(
    `/api/v1/archive-submissions/physical-location/items${query ? `?${query}` : ''}`,
  )
  return response.data.items
}

export type ArchivePhysicalLocationBoxT = {
  id: string
  name: string
  capacity: number | null
  usedCapacity: number
  remainingCapacity: number | null
  breadcrumb: string
}

export async function getArchivePhysicalLocationBoxes(params?: {
  availableOnly?: boolean
}) {
  const searchParams = new URLSearchParams()
  if (params?.availableOnly) searchParams.set('availableOnly', 'true')
  const query = searchParams.toString()
  const response = await apiClient.get<{
    items: Array<ArchivePhysicalLocationBoxT>
  }>(
    `/api/v1/archive-submissions/physical-location/boxes${query ? `?${query}` : ''}`,
  )
  return response.data.items
}

export type DossierPhysicalPlacementT = {
  id: string
  dossierId: string
  physicalItemId: string
  locationRootId: string | null
  units: number
  status: string
  placedAt: string
  notes: string | null
}

export async function getDossierPhysicalPlacement(dossierId: string) {
  const response = await apiClient.get<{
    placement: DossierPhysicalPlacementT | null
    breadcrumb: string | null
  }>(`/api/v1/archive-submissions/physical-location/by-dossier/${dossierId}`)
  return response.data
}

export async function placeDossierPhysicalLocation(payload: {
  dossierId: string
  physicalItemId: string
  notes?: string | null
}) {
  const response = await apiClient.post<{
    placement: DossierPhysicalPlacementT
    breadcrumb: string | null
  }>('/api/v1/archive-submissions/physical-location/place', payload)
  return response.data
}

export async function moveDossierPhysicalLocation(payload: {
  dossierId: string
  physicalItemId: string
  notes?: string | null
}) {
  const response = await apiClient.post<{
    placement: DossierPhysicalPlacementT
    breadcrumb: string | null
  }>('/api/v1/archive-submissions/physical-location/move', payload)
  return response.data
}

export async function removeDossierPhysicalLocation(payload: {
  dossierId: string
  notes?: string | null
}) {
  const response = await apiClient.post<{
    placement: DossierPhysicalPlacementT
  }>('/api/v1/archive-submissions/physical-location/remove', payload)
  return response.data
}
