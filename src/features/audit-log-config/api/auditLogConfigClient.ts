import { apiClient } from '@/lib/api/apiClient'
import type {
  AuditLogConfigGroupT,
  AuditLogConfigResponseT,
} from '@/features/audit-log-config/types'

export async function getAuditLogConfig(): Promise<AuditLogConfigResponseT> {
  const response = await apiClient.get<AuditLogConfigResponseT>(
    '/api/v1/admin/audit-log-config',
  )
  return response.data
}

export async function updateAuditLogConfigToggles(
  items: Array<{ module: string; actionKey: string; enabled: boolean }>,
): Promise<AuditLogConfigResponseT> {
  const response = await apiClient.put<AuditLogConfigResponseT>(
    '/api/v1/admin/audit-log-config',
    { items },
  )
  return response.data
}

export type { AuditLogConfigGroupT }
