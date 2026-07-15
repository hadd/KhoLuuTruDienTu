import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'
import i18n from '@/lib/i18n/config'

export const retentionDurationUnitSchema = z.enum(['YEAR', 'MONTH', 'DAY'])

export const retentionPeriodSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
})

export type RetentionPeriodSearchT = z.infer<typeof retentionPeriodSearchSchema>

export const retentionPeriodFormSchema = z.object({
  durationValue: z.coerce.number().int().min(1, {
    message: i18n.t('form.fields.durationValue.required', {
      ns: 'retention-period',
    }),
  }),
  durationUnit: retentionDurationUnitSchema,
})

export type RetentionPeriodFormValues = z.infer<typeof retentionPeriodFormSchema>
