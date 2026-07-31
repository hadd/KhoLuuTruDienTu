import type { UserT } from '@/features/auth/types'

export type AuditLogUserT = Pick<UserT, 'id' | 'fullName' | 'email'>

export type AuditLogEntityT = {
  type: string
  id: string
  label: string
  exists: boolean
  link?: string | null
}

export type AuditLogT = {
  id: string
  requestId: string | null
  userId: string | null
  userRole: string | null
  method: string
  path: string
  query: Record<string, unknown> | null
  action: string | null
  module: string | null
  eventType: string | null
  entityType: string | null
  entityId: string | null
  entityLabel: string | null
  summary: string | null
  sourceLogId: string | null
  statusCode: number
  responseTime: number | null
  ip: string | null
  userAgent: string | null
  requestBody: Record<string, unknown> | null
  responseBody: Record<string, unknown> | null
  error: string | null
  createdAt: string
  viewCount?: number
  source?: 'live' | 'archived'
  user?: AuditLogUserT | null
  entity?: AuditLogEntityT | null
}

export type GetAuditLogsParamsT = {
  page?: number
  limit?: number
  search?: string
  userId?: string
  dateFrom?: string
  dateTo?: string
  module?: string
  eventType?: string
}

export type AuditLogFilterOptionsT = {
  basicActions: Array<string>
  modules: Record<string, Array<string>>
}
