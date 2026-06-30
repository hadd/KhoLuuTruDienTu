import { z } from 'zod'

export const scanNodeFormSchema = z.object({
  name: z.string().trim().min(1).max(200),
})

export type ScanNodeFormValues = z.infer<typeof scanNodeFormSchema>

export const scanPageFormSchema = z.object({
  name: z.string().trim().min(1).max(200),
  rotation: z.union([
    z.literal(0),
    z.literal(90),
    z.literal(180),
    z.literal(270),
  ]),
  scale: z.number().min(0.5).max(2),
})

export type ScanPageFormValues = z.infer<typeof scanPageFormSchema>

export const scanSearchSchema = z.object({
  selectedId: z.string().optional(),
  pageId: z.string().optional(),
})

export type ScanSearch = z.infer<typeof scanSearchSchema>
