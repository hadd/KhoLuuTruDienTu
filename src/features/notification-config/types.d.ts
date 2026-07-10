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

export interface EmailSenderInfraT {
  hostConfigured: boolean
  port: number
  secure: boolean
}

export interface EmailSenderIdentityT {
  fromEmail: string
  fromName: string | null
  replyTo: string | null
  hasPassword: boolean
}

export interface EmailConfigStatusT {
  configured: boolean
  infraReady: boolean
  senderReady: boolean
  missingFields: Array<string>
  infra: EmailSenderInfraT
  sender: EmailSenderIdentityT | null
}

export interface EmailSenderUpsertPayloadT {
  fromEmail: string
  fromName?: string | null
  replyTo?: string | null
  password?: string
}

export interface EmailSenderTestSendPayloadT {
  to?: string
}

export interface EmailSenderTestSendResultT {
  sentTo: string
}
