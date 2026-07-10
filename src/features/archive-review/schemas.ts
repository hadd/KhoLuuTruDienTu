import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const archiveReviewSearchSchema = listPageSearchSchema

export type ArchiveReviewSearchT = z.infer<typeof archiveReviewSearchSchema>
