import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'
import i18n from '@/lib/i18n/config'

export const retentionDurationUnitSchema = z.enum(['YEAR', 'MONTH', 'DAY'])

export const retentionPeriodSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
})

export type RetentionPeriodSearchT = z.infer<typeof retentionPeriodSearchSchema>

export const retentionPeriodFormSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    description: z.string().trim().optional().default(''),
    isPermanent: z.boolean().default(false),
    durationValue: z.coerce.number().int().min(1).optional().nullable(),
    durationUnit: retentionDurationUnitSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.isPermanent) return

    if (data.durationValue == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationValue'],
        message: i18n.t('form.fields.durationValue.required', {
          ns: 'retention-period',
        }),
      })
    }

    if (!data.durationUnit) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationUnit'],
        message: i18n.t('form.fields.durationUnit.required', {
          ns: 'retention-period',
        }),
      })
    }
  })

export type RetentionPeriodFormValues = z.infer<typeof retentionPeriodFormSchema>
