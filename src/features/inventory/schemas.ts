import { z } from 'zod'

export const inventorySearchSchema = z.object({
  q: z.string().optional().catch(undefined),
})

export type InventorySearchT = z.infer<typeof inventorySearchSchema>

export const inventoryFormSchema = z.object({
  id: z.string().trim().min(1),
  number: z.string().trim().min(1),
  name: z.string().trim().min(1),
  fondId: z.string().trim().min(1),
  submissionYear: z.coerce.number().int().min(1000).max(9999),
  submittingUnit: z.string().trim().min(1),
})

export type InventoryFormValues = z.infer<typeof inventoryFormSchema>
