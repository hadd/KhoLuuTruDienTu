export interface SecurityLevelT {
  id: string
  name: string
  description: string
  levelOrder: number
  requireEncryption: boolean
  requireWatermark: boolean
  exportRoleIds: Array<string>
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CreateSecurityLevelPayloadT = {
  name: string
  description?: string
  levelOrder: number
  requireEncryption?: boolean
  requireWatermark?: boolean
  exportRoleIds?: Array<string>
  isActive?: boolean
}

export type UpdateSecurityLevelPayloadT = Partial<CreateSecurityLevelPayloadT>

export type GetSecurityLevelsParamsT = {
  page?: number
  limit?: number
  search?: string
}

export interface SecurityLevelAuditLogUserT {
  id: string
  fullName: string | null
  email: string
}

export interface SecurityLevelAuditLogT {
  id: string
  requestId: string | null
  userId: string | null
  userRole: string | null
  method: string
  path: string
  action: string | null
  statusCode: number
  responseTime: number | null
  createdAt: string
  requestBody: Record<string, unknown> | null
  responseBody: Record<string, unknown> | null
  user?: SecurityLevelAuditLogUserT | null
}

export type GetSecurityLevelAuditLogsParamsT = {
  page?: number
  limit?: number
}
