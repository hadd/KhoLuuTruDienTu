import { z } from 'zod'

import { CATALOG_TYPE_SORT_FIELDS } from '@/features/general-catalog/lib/catalogListSort'
import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const catalogTypeListSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
  sortBy: z.enum(CATALOG_TYPE_SORT_FIELDS).optional().catch(undefined),
  sortDir: z.enum(['asc', 'desc']).optional().catch(undefined),
})

export type CatalogTypeListSearchT = z.infer<typeof catalogTypeListSearchSchema>
