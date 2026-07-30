import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const auditLogSearchSchema = listPageSearchSchema.extend({
  userId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  module: z.string().optional(),
  eventType: z.string().optional(),
  logId: z.string().optional(),
})

export type AuditLogSearchT = z.infer<typeof auditLogSearchSchema>
