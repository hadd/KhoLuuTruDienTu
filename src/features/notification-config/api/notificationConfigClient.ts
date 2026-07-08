import type {
  CreateNotificationConfigPayloadT,
  NotificationConfigAuditLogT,
  NotificationConfigMutationResultT,
  NotificationConfigMutationWarningT,
  NotificationConfigT,
  NotificationRoleIdT,
  NotificationRoleOptionT,
  NotificationTypeOptionT,
  UpdateNotificationConfigPayloadT,
} from '@/features/notification-config/types'

const STORAGE_KEY = 'mock:notification-configs'
const MOCK_ACTOR_NAME = 'Admin'

export const notificationRoleOptions: Array<NotificationRoleOptionT> = [
  { id: 'admin', name: 'Admin', activeUserCount: 2 },
  { id: 'editor', name: 'Editor', activeUserCount: 4 },
  { id: 'qc', name: 'QC', activeUserCount: 0 },
]

export const notificationTypeOptions: Array<NotificationTypeOptionT> = [
  {
    id: 'OCR_COMPLETED',
    name: 'OCR completed',
    description: 'Notify selected recipients when OCR processing is done.',
  },
  {
    id: 'DOSSIER_ASSIGNED',
    name: 'Dossier assigned',
    description: 'Notify assigned editors when a dossier is assigned.',
  },
]

function nowIso(): string {
  return new Date().toISOString()
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createAuditLog(
  action: NotificationConfigAuditLogT['action'],
  note: string,
): NotificationConfigAuditLogT {
  return {
    id: createId('audit'),
    action,
    actorName: MOCK_ACTOR_NAME,
    createdAt: nowIso(),
    note,
  }
}

const mockConfigs: Array<NotificationConfigT> = [
  {
    id: 'notification-config-ocr-admin',
    notificationType: 'OCR_COMPLETED',
    channels: ['system'],
    roleIds: ['admin'],
    active: true,
    createdByName: MOCK_ACTOR_NAME,
    updatedByName: MOCK_ACTOR_NAME,
    createdAt: '2026-07-08T08:00:00.000Z',
    updatedAt: '2026-07-08T08:00:00.000Z',
    auditLogs: [
      {
        id: 'audit-ocr-admin-created',
        action: 'create',
        actorName: MOCK_ACTOR_NAME,
        createdAt: '2026-07-08T08:00:00.000Z',
        note: 'Mock seed created.',
      },
    ],
  },
  {
    id: 'notification-config-assigned-editor',
    notificationType: 'DOSSIER_ASSIGNED',
    channels: ['system', 'email'],
    roleIds: ['editor'],
    active: true,
    createdByName: MOCK_ACTOR_NAME,
    updatedByName: MOCK_ACTOR_NAME,
    createdAt: '2026-07-08T08:30:00.000Z',
    updatedAt: '2026-07-08T08:30:00.000Z',
    auditLogs: [
      {
        id: 'audit-assigned-editor-created',
        action: 'create',
        actorName: MOCK_ACTOR_NAME,
        createdAt: '2026-07-08T08:30:00.000Z',
        note: 'Mock seed created.',
      },
    ],
  },
]

function readConfigs(): Array<NotificationConfigT> {
  if (typeof window === 'undefined') return mockConfigs

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mockConfigs))
    return mockConfigs
  }

  try {
    return JSON.parse(raw) as Array<NotificationConfigT>
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mockConfigs))
    return mockConfigs
  }
}

function writeConfigs(configs: Array<NotificationConfigT>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
}

function getWarnings(
  roleIds: Array<NotificationRoleIdT>,
): Array<NotificationConfigMutationWarningT> {
  return roleIds
    .map((roleId) => notificationRoleOptions.find((role) => role.id === roleId))
    .filter((role): role is NotificationRoleOptionT => Boolean(role))
    .filter((role) => role.activeUserCount === 0)
    .map((role) => ({
      code: 'ROLE_HAS_NO_ACTIVE_USERS',
      roleId: role.id,
    }))
}

function assertUniqueConfig(
  configs: Array<NotificationConfigT>,
  payload: CreateNotificationConfigPayloadT,
  ignoredConfigId?: string,
): void {
  const duplicated = configs.some((config) => {
    if (config.id === ignoredConfigId) return false
    if (config.notificationType !== payload.notificationType) return false

    const hasOverlappingChannel = config.channels.some((channel) =>
      payload.channels.includes(channel),
    )
    const hasOverlappingRole = config.roleIds.some((roleId) =>
      payload.roleIds.includes(roleId),
    )

    return hasOverlappingChannel && hasOverlappingRole
  })

  if (duplicated) {
    throw new Error('notificationConfigDuplicate')
  }
}

export function getNotificationConfigs(): Array<NotificationConfigT> {
  return readConfigs()
}

export function createNotificationConfig(
  payload: CreateNotificationConfigPayloadT,
): NotificationConfigMutationResultT {
  const configs = readConfigs()
  assertUniqueConfig(configs, payload)

  const createdAt = nowIso()
  const record: NotificationConfigT = {
    id: createId('notification-config'),
    ...payload,
    createdByName: MOCK_ACTOR_NAME,
    updatedByName: MOCK_ACTOR_NAME,
    createdAt,
    updatedAt: createdAt,
    auditLogs: [createAuditLog('create', 'Notification config created.')],
  }

  writeConfigs([record, ...configs])

  return {
    record,
    warnings: getWarnings(payload.roleIds),
  }
}

export function updateNotificationConfig(
  configId: string,
  payload: UpdateNotificationConfigPayloadT,
): NotificationConfigMutationResultT {
  const configs = readConfigs()
  assertUniqueConfig(configs, payload, configId)

  const record = configs.find((config) => config.id === configId)
  if (!record) throw new Error('notificationConfigNotFound')

  const updatedRecord: NotificationConfigT = {
    ...record,
    ...payload,
    updatedByName: MOCK_ACTOR_NAME,
    updatedAt: nowIso(),
    auditLogs: [
      createAuditLog('update', 'Notification config updated.'),
      ...record.auditLogs,
    ],
  }

  writeConfigs(
    configs.map((config) => (config.id === configId ? updatedRecord : config)),
  )

  return {
    record: updatedRecord,
    warnings: getWarnings(payload.roleIds),
  }
}

export function updateNotificationConfigStatus(
  configId: string,
  active: boolean,
): NotificationConfigT {
  const configs = readConfigs()
  const record = configs.find((config) => config.id === configId)
  if (!record) throw new Error('notificationConfigNotFound')

  const updatedRecord: NotificationConfigT = {
    ...record,
    active,
    updatedByName: MOCK_ACTOR_NAME,
    updatedAt: nowIso(),
    auditLogs: [
      createAuditLog(
        active ? 'activate' : 'deactivate',
        active
          ? 'Notification config activated.'
          : 'Notification config deactivated.',
      ),
      ...record.auditLogs,
    ],
  }

  writeConfigs(
    configs.map((config) => (config.id === configId ? updatedRecord : config)),
  )

  return updatedRecord
}

export function deleteNotificationConfig(configId: string): void {
  const configs = readConfigs()
  writeConfigs(configs.filter((config) => config.id !== configId))
}

