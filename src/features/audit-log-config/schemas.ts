import { z } from 'zod'

export const auditLogSettingsSchema = z.object({
  retentionDays: z.coerce.number().int().min(1).max(3650),
  purgeEnabled: z.boolean(),
})

export type AuditLogSettingsFormT = z.infer<typeof auditLogSettingsSchema>
