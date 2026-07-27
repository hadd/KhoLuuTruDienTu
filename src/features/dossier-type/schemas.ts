export { catalogTypeListSearchSchema as dossierTypeSearchSchema } from '@/features/general-catalog/schemas/catalogTypeListSearch'
export type { CatalogTypeListSearchT as DossierTypeSearchT } from '@/features/general-catalog/schemas/catalogTypeListSearch'

import { z } from 'zod'

export const dossierTypeFormSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional().default(''),
})

export type DossierTypeFormValues = z.infer<typeof dossierTypeFormSchema>
