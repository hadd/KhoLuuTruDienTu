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
  levelOrder: number
  description?: string
  isActive?: boolean
}

export type UpdateSecurityLevelPayloadT = Partial<CreateSecurityLevelPayloadT>

export type GetSecurityLevelsParamsT = {
  page?: number
  limit?: number
  search?: string
}

export type SecurityResolvedRuleT = {
  ruleKey: string
  effectiveValue: unknown
  isOverridden: boolean
  inheritedFromLevelId: string | null
  inheritedFromLevelName: string | null
  isLowestLevel: boolean
}

export type SecurityLevelRulesResponseT = {
  securityLevelId: string
  hasPassword: boolean
  hasFilePassword?: boolean
  rules: Array<SecurityResolvedRuleT>
}

export type PatchSecurityLevelRulesPayloadT = {
  confirmLooser?: boolean
  password?: string | null
  clearPassword?: boolean
  filePassword?: string | null
  clearFilePassword?: boolean
  rules: Array<{
    ruleKey: string
    isOverridden: boolean
    value?: unknown
  }>
}

export type SecurityPermissionDefT = {
  id: string
  key: string
  name: string
  description: string
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
