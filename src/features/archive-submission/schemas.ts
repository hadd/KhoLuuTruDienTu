import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const archiveDossierStatusFilterSchema = z.enum([
  'APPROVED',
  'PENDING_ARCHIVE',
  'ARCHIVED',
  'ARCHIVE_REJECTED',
])

export const archiveSubmissionSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
  status: archiveDossierStatusFilterSchema.optional().catch(undefined),
})

export type ArchiveSubmissionSearchT = z.infer<typeof archiveSubmissionSearchSchema>
