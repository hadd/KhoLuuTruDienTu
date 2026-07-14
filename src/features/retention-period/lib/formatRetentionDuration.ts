import type { TFunction } from 'i18next'

import type { RetentionPeriodT } from '@/features/retention-period/types'

export function formatRetentionDurationLabel(
  period: Pick<
    RetentionPeriodT,
    'isPermanent' | 'durationValue' | 'durationUnit'
  >,
  t: TFunction<'retention-period'>,
): string {
  if (period.isPermanent) {
    return t('duration.permanent')
  }

  if (period.durationValue == null || !period.durationUnit) {
    return t('duration.unconfigured')
  }

  return t(`duration.units.${period.durationUnit}`, {
    count: period.durationValue,
  })
}
