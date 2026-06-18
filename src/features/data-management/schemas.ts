import { z } from 'zod'

export const dataManagementSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  nodeId: z.string().optional().catch(undefined),
  focusDocumentId: z.string().optional().catch(undefined),
  focusGroupIndex: z.coerce.number().int().nonnegative().optional().catch(undefined),
  projectCode: z.string().optional().catch(undefined),
})

export type DataManagementSearch = z.infer<typeof dataManagementSearchSchema>
