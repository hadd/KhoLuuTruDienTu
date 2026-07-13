import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const warehouseDossierStatusSchema = z.enum(['ARCHIVED'])

export const archiveWarehouseDossiersSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
  fondId: z.string().optional().catch(undefined),
  year: z.coerce.number().int().optional().catch(undefined),
  status: warehouseDossierStatusSchema.optional().catch(undefined),
  dossierId: z.string().uuid().optional().catch(undefined),
})

export type ArchiveWarehouseDossiersSearchT = z.infer<
  typeof archiveWarehouseDossiersSearchSchema
>
