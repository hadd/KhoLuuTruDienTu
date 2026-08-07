export type NotificationChannelT = 'system' | 'email'

export type NotificationTypeT =
  | 'OCR_COMPLETED'
  | 'DOSSIER_ASSIGNED'
  | 'EDITORS_COMPLETED'
  | 'QC_STEP_COMPLETED'
  | 'DOSSIER_APPROVED'
  | 'DISPOSAL_COUNCIL_ASSIGNED'

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

export type SmtpProviderT = 'gmail' | 'outlook' | 'office365' | 'custom'

export interface EmailSenderSmtpT {
  host: string | null
  port: number
  secure: boolean
  user: string | null
}

export interface EmailSenderIdentityT {
  fromEmail: string
  fromName: string | null
  replyTo: string | null
  hasPassword: boolean
}

export interface EmailConfigStatusT {
  configured: boolean
  missingFields: Array<string>
  smtp: EmailSenderSmtpT
  sender: EmailSenderIdentityT | null
  smtpProvider: SmtpProviderT
}

export interface EmailSenderUpsertPayloadT {
  smtpProvider?: SmtpProviderT
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string | null
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
