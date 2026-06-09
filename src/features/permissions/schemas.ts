import { z } from 'zod'

export const functionPermissionSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
})

export type FunctionPermissionSearchT = z.infer<typeof functionPermissionSearchSchema>
