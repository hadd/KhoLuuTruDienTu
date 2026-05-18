import { z } from 'zod'

export const dataManagementSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  nodeId: z.string().optional().catch(undefined),
})

export type DataManagementSearch = z.infer<typeof dataManagementSearchSchema>
