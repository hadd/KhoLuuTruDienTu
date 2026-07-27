export { catalogTypeListSearchSchema as documentTypeSearchSchema } from '@/features/general-catalog/schemas/catalogTypeListSearch'
export type { CatalogTypeListSearchT as DocumentTypeSearchT } from '@/features/general-catalog/schemas/catalogTypeListSearch'

import { z } from 'zod'

export const RETENTION_PERIOD_NONE = '__none__'

export const documentTypeFormSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional().default(''),
  retentionPeriodId: z.string().optional().default(RETENTION_PERIOD_NONE),
})

export type DocumentTypeFormValues = z.infer<typeof documentTypeFormSchema>
