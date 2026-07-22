export interface SecurityLevelT {
  id: string
  name: string
  description: string
  levelOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CreateSecurityLevelPayloadT = {
  name: string
  description?: string
  levelOrder: number
  isActive?: boolean
}

export type UpdateSecurityLevelPayloadT = Partial<CreateSecurityLevelPayloadT>

export type GetSecurityLevelsParamsT = {
  page?: number
  limit?: number
  search?: string
}
