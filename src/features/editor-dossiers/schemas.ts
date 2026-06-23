import { z } from 'zod'

export const editorDossiersSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(1),
})

export type EditorDossiersSearch = z.infer<typeof editorDossiersSearchSchema>
