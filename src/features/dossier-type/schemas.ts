import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const dossierTypeSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
})

export type DossierTypeSearchT = z.infer<typeof dossierTypeSearchSchema>

export const dossierTypeFormSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional().default(''),
})

export type DossierTypeFormValues = z.infer<typeof dossierTypeFormSchema>
