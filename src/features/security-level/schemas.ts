import { z } from 'zod'

import i18n from '@/lib/i18n/config'
import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const securityLevelSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
})

export type SecurityLevelSearchT = z.infer<typeof securityLevelSearchSchema>

export const securityLevelFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().optional().default(''),
  levelOrder: z.coerce
    .number({
      error: (issue) =>
        issue.code === 'invalid_type'
          ? i18n.t('form.fields.levelOrder.mustBeNaturalNumber', {
              ns: 'security-level',
            })
          : undefined,
    })
    .int({
      error: () =>
        i18n.t('form.fields.levelOrder.mustBeNaturalNumber', {
          ns: 'security-level',
        }),
    })
    .min(1, {
      error: () =>
        i18n.t('form.fields.levelOrder.mustBeNaturalNumber', {
          ns: 'security-level',
        }),
    }),
})

export type SecurityLevelFormValues = z.infer<typeof securityLevelFormSchema>
