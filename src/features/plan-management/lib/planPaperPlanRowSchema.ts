import { z } from 'zod'

export const paperPlanRowSchema = z.object({
  paperSizeName: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
})

export type PaperPlanRowFormValues = z.infer<typeof paperPlanRowSchema>
