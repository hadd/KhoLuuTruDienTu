export type NotificationChannelT = 'system' | 'email'

export type NotificationTypeT = 'OCR_COMPLETED' | 'DOSSIER_ASSIGNED'

export interface NotificationTypeOptionT {
  id: NotificationTypeT
  name: string
  description: string
}

export interface NotificationConfigT {
  id: string
  notificationType: NotificationTypeT
  channels: Array<NotificationChannelT>
  roleIds: Array<string>
  active: boolean
  dedupeKey: string
  createdById: string | null
  updatedById: string | null
  createdAt: string
  updatedAt: string
}

export interface NotificationConfigMutationResultT {
  record: NotificationConfigT
  warnings: Array<string>
}

export interface CreateNotificationConfigPayloadT {
  notificationType: NotificationTypeT
  channels: Array<NotificationChannelT>
  roleIds: Array<string>
  active: boolean
}

export type UpdateNotificationConfigPayloadT =
  CreateNotificationConfigPayloadT

export interface GetNotificationConfigsParamsT {
  notificationType?: NotificationTypeT
  roleId?: string
  active?: boolean
  search?: string
}
