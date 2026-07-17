import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'
import i18n from '@/lib/i18n/config'

export const retentionDurationUnitSchema = z.enum(['YEAR', 'MONTH', 'DAY'])

export const retentionPeriodSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
})

export type RetentionPeriodSearchT = z.infer<typeof retentionPeriodSearchSchema>

export const retentionPeriodFormSchema = z.object({
  durationValue: z.coerce
    .number({
      // Zod v4: lỗi kiểu (ô trống -> NaN) dùng thông báo "bắt buộc nhập"
      error: (issue) =>
        issue.code === 'invalid_type'
          ? i18n.t('form.fields.durationValue.required', {
              ns: 'retention-period',
            })
          : undefined,
    })
    .int({
      error: () =>
        i18n.t('form.fields.durationValue.mustBeInteger', {
          ns: 'retention-period',
        }),
    })
    .min(1, {
      error: () =>
        i18n.t('form.fields.durationValue.required', {
          ns: 'retention-period',
        }),
    }),
  durationUnit: retentionDurationUnitSchema,
})

export type RetentionPeriodFormValues = z.infer<typeof retentionPeriodFormSchema>
