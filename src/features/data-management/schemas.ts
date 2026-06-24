import { z } from 'zod'

export const dataManagementSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  dossierId: z.string().optional().catch(undefined),
  nodeId: z.string().optional().catch(undefined),
  focusDocumentId: z.string().optional().catch(undefined),
  focusGroupIndex: z.coerce.number().int().nonnegative().optional().catch(undefined),
  projectCode: z.string().optional().catch(undefined),
})

export type DataManagementSearch = z.infer<typeof dataManagementSearchSchema>

export const editorErrorReportSubmitSchema = z.object({
  errorType: z.enum(['cannot_open_file', 'wrong_highlight', 'other']),
  description: z.string().trim().min(1),
})

export type EditorErrorReportSubmitForm = z.infer<
  typeof editorErrorReportSubmitSchema
>

export const editorErrorReportRejectSchema = z.object({
  rejectNote: z.string().trim().min(1),
})

export type EditorErrorReportRejectForm = z.infer<
  typeof editorErrorReportRejectSchema
>
