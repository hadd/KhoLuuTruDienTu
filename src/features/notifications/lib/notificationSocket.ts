import { z } from 'zod'

import type { NotificationRealtimePayloadT } from '@/features/notifications/types'

export const notificationRealtimePayloadSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'OCR_COMPLETED',
    'DOSSIER_ASSIGNED',
    'EDITORS_COMPLETED',
    'QC_STEP_COMPLETED',
    'DOSSIER_APPROVED',
  ]),
  title: z.string(),
  body: z.string(),
  actionUrl: z.string(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  createdAt: z.string(),
})

export function parseNotificationRealtimePayload(
  raw: unknown,
): NotificationRealtimePayloadT | null {
  const parsed = notificationRealtimePayloadSchema.safeParse(raw)
  if (!parsed.success) {
    if (
      typeof window !== 'undefined' &&
      window.localStorage.getItem('debug:notification-socket') === '1'
    ) {
      console.warn('[notification-socket] invalid notification:new payload', {
        issues: parsed.error.issues,
        raw,
      })
    }
    return null
  }
  return parsed.data
}
