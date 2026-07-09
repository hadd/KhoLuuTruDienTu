import type {
  CreateRetentionPeriodPayloadT,
  GetRetentionPeriodsParamsT,
  RetentionPeriodT,
  UpdateRetentionPeriodPayloadT,
} from '@/features/retention-period/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'

export async function getRetentionPeriods(
  params?: GetRetentionPeriodsParamsT,
): Promise<PaginatedResponse<RetentionPeriodT>> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
    search: params?.search,
  })

  const queryString = searchParams.toString()
  const url = `/api/v1/retention-periods${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<PaginatedResponse<RetentionPeriodT>>(url)
  return response.data
}

export async function createRetentionPeriodRecord(
  payload: CreateRetentionPeriodPayloadT,
): Promise<RetentionPeriodT> {
  const response = await apiClient.post<SingleResourceResponse<RetentionPeriodT>>(
    '/api/v1/retention-periods',
    payload,
  )
  return response.data.record
}

export async function updateRetentionPeriodRecord(
  id: string,
  payload: UpdateRetentionPeriodPayloadT,
): Promise<RetentionPeriodT> {
  const response = await apiClient.put<SingleResourceResponse<RetentionPeriodT>>(
    `/api/v1/retention-periods/${id}`,
    payload,
  )
  return response.data.record
}

export async function deleteRetentionPeriodRecord(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/retention-periods/${id}`)
}
