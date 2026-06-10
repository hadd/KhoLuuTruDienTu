import { z } from 'zod'

export const documentTypeSearchSchema = z.object({
  templateId: z.string().optional(),
})

export type DocumentTypeSearchT = z.infer<typeof documentTypeSearchSchema>

export const documentAssignmentSearchSchema = z.object({
  templateId: z.string().optional(),
  levelId: z.string().optional(),
})

export type DocumentAssignmentSearchT = z.infer<
  typeof documentAssignmentSearchSchema
>
