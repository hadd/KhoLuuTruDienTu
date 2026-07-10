import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const archiveFondSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
})

export type ArchiveFondSearchT = z.infer<typeof archiveFondSearchSchema>

export const archiveFondFormSchema = z.object({
  id: z.string().trim().min(1),
  fondName: z.string().trim().min(1),
  archiveAgency: z.string().trim().min(1),
  adminstrativeHistory: z.string().trim().min(1),
  fondType: z.string().trim().min(1),
  isActive: z.boolean().default(true),
})

export type ArchiveFondFormValues = z.infer<typeof archiveFondFormSchema>
