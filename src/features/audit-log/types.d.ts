import type { UserT } from '@/features/auth/types'

export type AuditLogUserT = Pick<UserT, 'id' | 'fullName' | 'email'>

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
  user?: AuditLogUserT | null
}

export type AuditLogArchiveT = {
  id: string
  exportedAt: string
  dateFrom: string
  dateTo: string
  recordCount: number
  jsonObjectKey: string | null
  excelObjectKey: string | null
  purgedCount: number
  status: string
  error: string | null
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
