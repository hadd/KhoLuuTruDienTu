import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import type {
  AuditLogFilterOptionsT,
  AuditLogT,
  GetAuditLogsParamsT,
} from '@/features/audit-log/types'

export async function getAuditLogs(
  params?: GetAuditLogsParamsT,
): Promise<PaginatedResponse<AuditLogT>> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page,
    limit: params?.limit,
    search: params?.search,
  })
  if (params?.userId) searchParams.set('userId', params.userId)
  if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom)
  if (params?.dateTo) searchParams.set('dateTo', params.dateTo)
  if (params?.module) searchParams.set('module', params.module)
  if (params?.eventType) searchParams.set('eventType', params.eventType)

  const queryString = searchParams.toString()
  const url = `/api/v1/admin/audit-logs${queryString ? `?${queryString}` : ''}`
  const response = await apiClient.get<PaginatedResponse<AuditLogT>>(url)
  return response.data
}

export async function getAuditLog(id: string): Promise<AuditLogT> {
  const response = await apiClient.get<SingleResourceResponse<AuditLogT>>(
    `/api/v1/admin/audit-logs/${id}`,
  )
  return response.data.record
}

export async function deleteAuditLog(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/admin/audit-logs/${id}`)
}

export async function deleteAuditLogsBulk(input: {
  ids?: Array<string>
  query?: GetAuditLogsParamsT
}): Promise<{ deletedCount: number }> {
  const response = await apiClient.delete<{ deletedCount: number }>(
    '/api/v1/admin/audit-logs/bulk',
    { data: input },
  )
  return response.data
}

export async function exportAuditLogs(
  params: GetAuditLogsParamsT & { format?: 'json' | 'xlsx' },
): Promise<Blob> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, params)
  if (params.userId) searchParams.set('userId', params.userId)
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom)
  if (params.dateTo) searchParams.set('dateTo', params.dateTo)
  if (params.module) searchParams.set('module', params.module)
  if (params.eventType) searchParams.set('eventType', params.eventType)
  searchParams.set('format', params.format ?? 'json')

  const response = await apiClient.get<Blob>(
    `/api/v1/admin/audit-logs/export?${searchParams.toString()}`,
    { responseType: 'blob' },
  )
  return response.data
}

export async function getAuditLogFilterOptions(): Promise<AuditLogFilterOptionsT> {
  const response = await apiClient.get<AuditLogFilterOptionsT>(
    '/api/v1/admin/audit-logs/filter-options',
  )
  return response.data
}
