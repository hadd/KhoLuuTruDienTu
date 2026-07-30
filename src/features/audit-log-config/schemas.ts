import { z } from 'zod'

export const auditLogSettingsSchema = z.object({
  retentionDays: z.coerce.number().int().min(1).max(3650),
  purgeEnabled: z.boolean(),
})

export const auditLogConfigSearchSchema = z.object({
  module: z.string().optional(),
})

export type AuditLogSettingsFormT = z.infer<typeof auditLogSettingsSchema>
export type AuditLogConfigSearchT = z.infer<typeof auditLogConfigSearchSchema>
