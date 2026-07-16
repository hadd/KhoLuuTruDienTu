export type RetentionDurationUnitT = 'YEAR' | 'MONTH' | 'DAY'

export interface RetentionPeriodT {
  id: string
  /** @deprecated Dropped from schema; kept optional for older clients. */
  name?: string
  /** @deprecated Dropped from schema; kept optional for older clients. */
  description?: string
  durationValue: number | null
  durationUnit: RetentionDurationUnitT | null
  isPermanent: boolean
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

export type CreateRetentionPeriodPayloadT = {
  id: string
  name: string
  description?: string
  isPermanent?: boolean
  durationValue?: number | null
  durationUnit?: RetentionDurationUnitT | null
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
