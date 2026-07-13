import type {
  ArchiveFondT,
  CreateArchiveFondPayloadT,
  GetArchiveFondsParamsT,
  UpdateArchiveFondPayloadT,
} from '@/features/archive-fond/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'

export async function getArchiveFonds(
  params?: GetArchiveFondsParamsT,
): Promise<PaginatedResponse<ArchiveFondT>> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
    search: params?.search,
  })

  const queryString = searchParams.toString()
  const url = `/api/v1/fonds${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<PaginatedResponse<ArchiveFondT>>(url)
  return response.data
}

export async function createArchiveFondRecord(
  payload: CreateArchiveFondPayloadT,
): Promise<ArchiveFondT> {
  const response = await apiClient.post<SingleResourceResponse<ArchiveFondT>>(
    '/api/v1/fonds',
    payload,
  )
  return response.data.record
}

export async function updateArchiveFondRecord(
  id: string,
  payload: UpdateArchiveFondPayloadT,
): Promise<ArchiveFondT> {
  const response = await apiClient.put<SingleResourceResponse<ArchiveFondT>>(
    `/api/v1/fonds/${id}`,
    payload,
  )
  return response.data.record
}

export async function deleteArchiveFondRecord(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/fonds/${id}`)
}

export async function getActiveArchiveFonds(): Promise<{
  items: Array<ArchiveFondT>
}> {
  const response = await apiClient.get<{ items: Array<ArchiveFondT> }>(
    '/api/v1/fonds/active',
  )
  return response.data
}
