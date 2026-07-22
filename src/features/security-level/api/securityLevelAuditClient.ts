import { SECURITY_LEVEL_AUDIT_ACTIONS } from '@/features/security-level/lib/securityLevelAudit'
import type {
  GetSecurityLevelAuditLogsParamsT,
  SecurityLevelAuditLogT,
} from '@/features/security-level/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import type { PaginatedResponse } from '@/types/api'

export async function getSecurityLevelAuditLogs(
  params?: GetSecurityLevelAuditLogsParamsT,
): Promise<PaginatedResponse<SecurityLevelAuditLogT>> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 10,
    sort: 'createdAt:desc',
  })
  searchParams.set(
    'filter[action][$in]',
    SECURITY_LEVEL_AUDIT_ACTIONS.join(','),
  )

  const queryString = searchParams.toString()
  const url = `/api/v1/admin/audit-logs${queryString ? `?${queryString}` : ''}`

  const response =
    await apiClient.get<PaginatedResponse<SecurityLevelAuditLogT>>(url)
  return response.data
}
