export type NotificationTypeT =
  | 'OCR_COMPLETED'
  | 'DOSSIER_ASSIGNED'
  | 'EDITORS_COMPLETED'
  | 'QC_STEP_COMPLETED'
  | 'DOSSIER_APPROVED'
  | 'SECURITY_LEVEL_CHANGED'

export interface NotificationInboxRecordT {
  id: string
  type: NotificationTypeT
  title: string
  body: string
  entityType: string | null
  entityId: string | null
  actionUrl: string
  payload: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}

export interface NotificationRealtimePayloadT {
  id: string
  type: NotificationTypeT
  title: string
  body: string
  actionUrl: string
  entityType: string | null
  entityId: string | null
  createdAt: string
}

export interface GetNotificationsParamsT {
  unreadOnly?: boolean
  limit?: number
  offset?: number
}

export interface NotificationUnreadCountT {
  count: number
}

export interface MarkAllNotificationsReadResultT {
  updatedCount: number
}
