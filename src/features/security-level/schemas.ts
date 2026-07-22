import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const securityLevelSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
})

export type SecurityLevelSearchT = z.infer<typeof securityLevelSearchSchema>

export const securityLevelFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().optional().default(''),
  levelOrder: z.coerce.number().int().min(1),
})

export type SecurityLevelFormValues = z.infer<typeof securityLevelFormSchema>
