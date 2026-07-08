export interface RetentionPeriodT {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export type CreateRetentionPeriodPayloadT = {
  id: string
  name: string
  description?: string
}

export type UpdateRetentionPeriodPayloadT = Omit<
  CreateRetentionPeriodPayloadT,
  'id'
>

export type GetRetentionPeriodsParamsT = {
  page?: number
  limit?: number
  search?: string
}
