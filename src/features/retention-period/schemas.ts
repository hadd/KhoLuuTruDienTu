import { z } from 'zod'

export const retentionPeriodSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
})

export type RetentionPeriodSearchT = z.infer<typeof retentionPeriodSearchSchema>

export const retentionPeriodFormSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim(),
})

export type RetentionPeriodFormValues = z.infer<typeof retentionPeriodFormSchema>
