export type RetentionDurationUnitT = 'YEAR' | 'MONTH' | 'DAY'

export interface RetentionPeriodT {
  id: string
  durationValue: number | null
  durationUnit: RetentionDurationUnitT | null
  isPermanent: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateRetentionPeriodPayloadT = {
  durationValue: number
  durationUnit: RetentionDurationUnitT
  isActive?: boolean
}

export type UpdateRetentionPeriodPayloadT = {
  durationValue?: number
  durationUnit?: RetentionDurationUnitT
  isActive?: boolean
}

export type GetRetentionPeriodsParamsT = {
  page?: number
  limit?: number
  search?: string
}
