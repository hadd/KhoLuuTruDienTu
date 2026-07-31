import { z } from 'zod'

export const auditLogConfigSearchSchema = z.object({
  module: z.string().optional(),
})

export type AuditLogConfigSearchT = z.infer<typeof auditLogConfigSearchSchema>
