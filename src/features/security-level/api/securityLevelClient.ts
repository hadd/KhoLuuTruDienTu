import type {
  CreateSecurityLevelPayloadT,
  GetSecurityLevelsParamsT,
  SecurityLevelT,
  UpdateSecurityLevelPayloadT,
} from '@/features/security-level/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'

export async function getSecurityLevels(
  params?: GetSecurityLevelsParamsT,
): Promise<PaginatedResponse<SecurityLevelT>> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
    search: params?.search,
  })

  const queryString = searchParams.toString()
  const url = `/api/v1/security-levels${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<PaginatedResponse<SecurityLevelT>>(url)
  return response.data
}

export async function getActiveSecurityLevels(): Promise<{
  items: Array<SecurityLevelT>
}> {
  const response = await apiClient.get<{ items: Array<SecurityLevelT> }>(
    '/api/v1/security-levels/active',
  )
  return response.data
}

export async function createSecurityLevelRecord(
  payload: CreateSecurityLevelPayloadT,
): Promise<SecurityLevelT> {
  const response = await apiClient.post<SingleResourceResponse<SecurityLevelT>>(
    '/api/v1/security-levels',
    payload,
  )
  return response.data.record
}

export async function updateSecurityLevelRecord(
  id: string,
  payload: UpdateSecurityLevelPayloadT,
): Promise<SecurityLevelT> {
  const response = await apiClient.put<SingleResourceResponse<SecurityLevelT>>(
    `/api/v1/security-levels/${encodeURIComponent(id)}`,
    payload,
  )
  return response.data.record
}

export async function deleteSecurityLevelRecord(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/security-levels/${encodeURIComponent(id)}`)
}
