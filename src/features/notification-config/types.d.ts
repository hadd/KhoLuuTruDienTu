export type NotificationChannelT = 'system' | 'email'

export type NotificationRoleIdT = 'admin' | 'editor' | 'qc'

export type NotificationTypeT = 'OCR_COMPLETED' | 'DOSSIER_ASSIGNED'

export type NotificationConfigStatusT = 'active' | 'inactive'

export interface NotificationRoleOptionT {
  id: NotificationRoleIdT
  name: string
  activeUserCount: number
}

export interface NotificationTypeOptionT {
  id: NotificationTypeT
  name: string
  description: string
}

export interface NotificationConfigAuditLogT {
  id: string
  action: 'create' | 'update' | 'activate' | 'deactivate' | 'delete'
  actorName: string
  createdAt: string
  note: string
}

export interface NotificationConfigT {
  id: string
  notificationType: NotificationTypeT
  channels: Array<NotificationChannelT>
  roleIds: Array<NotificationRoleIdT>
  active: boolean
  createdByName: string
  updatedByName: string
  createdAt: string
  updatedAt: string
  auditLogs: Array<NotificationConfigAuditLogT>
}

export interface NotificationConfigMutationWarningT {
  code: 'ROLE_HAS_NO_ACTIVE_USERS'
  roleId: NotificationRoleIdT
}

export interface NotificationConfigMutationResultT {
  record: NotificationConfigT
  warnings: Array<NotificationConfigMutationWarningT>
}

export interface CreateNotificationConfigPayloadT {
  notificationType: NotificationTypeT
  channels: Array<NotificationChannelT>
  roleIds: Array<NotificationRoleIdT>
  active: boolean
}

export type UpdateNotificationConfigPayloadT =
  CreateNotificationConfigPayloadT

