import { z } from 'zod'

export const adminRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
})

export type AdminRoleFormValues = z.infer<typeof adminRoleSchema>

export const functionPermissionSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  roleId: z.string().optional().catch(undefined),
  module: z.string().optional().catch(undefined),
})

export type FunctionPermissionSearchT = z.infer<typeof functionPermissionSearchSchema>
