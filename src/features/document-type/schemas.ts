import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const documentTypeSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
})

export type DocumentTypeSearchT = z.infer<typeof documentTypeSearchSchema>

/** `__none__` = chưa chọn thời hạn (map null khi submit). */
export const RETENTION_PERIOD_NONE = '__none__'

export const documentTypeFormSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional().default(''),
  retentionPeriodId: z.string().optional().default(RETENTION_PERIOD_NONE),
})

export type DocumentTypeFormValues = z.infer<typeof documentTypeFormSchema>
