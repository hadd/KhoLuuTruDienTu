import type { RetentionDurationUnitT } from '@/features/retention-period/types'

type RetentionPeriodDuration = {
  isPermanent: boolean
  durationValue?: number | null
  durationUnit?: RetentionDurationUnitT | null
}

export function computeRetentionExpiresAt(
  startAt: Date | string,
  period: RetentionPeriodDuration,
): Date | null {
  if (period.isPermanent) {
    return null
  }

  const value = period.durationValue
  const unit = period.durationUnit
  if (value == null || value < 1 || !unit) {
    return null
  }

  const expiresAt = new Date(startAt)
  if (Number.isNaN(expiresAt.getTime())) {
    return null
  }

  switch (unit) {
    case 'YEAR':
      expiresAt.setFullYear(expiresAt.getFullYear() + value)
      return expiresAt
    case 'MONTH':
      expiresAt.setMonth(expiresAt.getMonth() + value)
      return expiresAt
    case 'DAY':
      expiresAt.setDate(expiresAt.getDate() + value)
      return expiresAt
    default:
      return null
  }
}
