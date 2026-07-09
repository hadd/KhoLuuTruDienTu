import { z } from 'zod'

export const notificationChannelSchema = z.enum(['system', 'email'])
export const notificationRoleIdSchema = z.enum(['admin', 'editor', 'qc'])
export const notificationTypeSchema = z.enum([
  'OCR_COMPLETED',
  'DOSSIER_ASSIGNED',
])

export const notificationConfigSearchSchema = z.object({
  q: z.string().optional().catch(''),
  channel: notificationChannelSchema.optional().catch(undefined),
  roleId: notificationRoleIdSchema.optional().catch(undefined),
  notificationType: notificationTypeSchema.optional().catch(undefined),
  status: z.enum(['active', 'inactive']).optional().catch(undefined),
})

export const notificationConfigFormSchema = z.object({
  notificationType: notificationTypeSchema,
  channels: z.array(notificationChannelSchema).min(1),
  roleIds: z.array(notificationRoleIdSchema).min(1),
  active: z.boolean(),
})

export type NotificationConfigSearchT = z.infer<
  typeof notificationConfigSearchSchema
>

export type NotificationConfigFormT = z.infer<
  typeof notificationConfigFormSchema
>

