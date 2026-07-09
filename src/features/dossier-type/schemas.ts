import { z } from 'zod'

export const dossierTypeSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
})

export type DossierTypeSearchT = z.infer<typeof dossierTypeSearchSchema>

export const dossierTypeFormSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim(),
})

export type DossierTypeFormValues = z.infer<typeof dossierTypeFormSchema>
