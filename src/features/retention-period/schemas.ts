import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const retentionPeriodSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
})

export type RetentionPeriodSearchT = z.infer<typeof retentionPeriodSearchSchema>

export const retentionPeriodFormSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional().default(''),
})

export type RetentionPeriodFormValues = z.infer<typeof retentionPeriodFormSchema>
