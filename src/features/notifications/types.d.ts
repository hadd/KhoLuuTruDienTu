export type NotificationTypeT =
  | 'OCR_COMPLETED'
  | 'DOSSIER_ASSIGNED'
  | 'EDITORS_COMPLETED'
  | 'QC_STEP_COMPLETED'
  | 'DOSSIER_APPROVED'
  | 'DISPOSAL_COUNCIL_ASSIGNED'

export interface NotificationInboxRecordT {
  id: string
  type: NotificationTypeT
  title: string
  body: string
  actionUrl: string
  readAt: string | null
  createdAt: string
}

export interface NotificationRealtimePayloadT {
  id: string
  type: NotificationTypeT
  title: string
  body: string
  actionUrl: string
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
