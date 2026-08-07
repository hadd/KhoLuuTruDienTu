import type {
  CreateNotificationConfigPayloadT,
  EmailConfigStatusT,
  EmailSenderTestSendPayloadT,
  EmailSenderTestSendResultT,
  EmailSenderUpsertPayloadT,
  GetNotificationConfigsParamsT,
  NotificationConfigMutationResultT,
  NotificationConfigT,
  NotificationTypeOptionT,
  UpdateNotificationConfigPayloadT,
} from '@/features/notification-config/types'
import { apiClient } from '@/lib/api/apiClient'
import { isAxiosError } from 'axios'

const BASE_PATH = '/api/v1/admin/notification-configs'

export const notificationTypeOptions: Array<NotificationTypeOptionT> = [
  {
    id: 'OCR_COMPLETED',
    name: 'OCR completed',
    description: 'Notify selected recipients when OCR processing is done.',
  },
  {
    id: 'DOSSIER_ASSIGNED',
    name: 'New assignment',
    description: 'Notify assigned handlers when a new dossier assignment is created.',
  },
  {
    id: 'EDITORS_COMPLETED',
    name: 'Editors completed — waiting QC',
    description:
      'Notify assigned CHECKER_1 when all editors finish editing.',
  },
  {
    id: 'QC_STEP_COMPLETED',
    name: 'Previous QC step completed',
    description:
      'Notify the next assigned QC when a QC round is approved.',
  },
  {
    id: 'DOSSIER_APPROVED',
    name: 'Dossier approved',
    description:
      'Notify the project manager when a dossier is approved.',
  },
  {
    id: 'DISPOSAL_COUNCIL_ASSIGNED',
    name: 'Disposal council assigned',
    description:
      'Notify council members when they are assigned to a disposal review council.',
  },
]

export class NotificationConfigApiError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'duplicate'
      | 'notFound'
      | 'unknownRoles'
      | 'validation'
      | 'unknown',
    readonly details?: string,
  ) {
    super(message)
    this.name = 'NotificationConfigApiError'
  }
}

function parseApiError(error: unknown): NotificationConfigApiError {
  if (isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data as
      | { message?: string; error?: string }
      | undefined
    const message = data?.message ?? data?.error ?? error.message

    if (status === 409) {
      return new NotificationConfigApiError(
        'notificationConfigDuplicate',
        'duplicate',
        message,
      )
    }
    if (status === 404) {
      return new NotificationConfigApiError(
        'notificationConfigNotFound',
        'notFound',
        message,
      )
    }
    if (status === 400 && /unknown roles/i.test(message)) {
      return new NotificationConfigApiError(
        'notificationConfigUnknownRoles',
        'unknownRoles',
        message,
      )
    }
    if (status === 400) {
      return new NotificationConfigApiError(
        message,
        'validation',
        message,
      )
    }
  }

  if (error instanceof Error) {
    return new NotificationConfigApiError(error.message, 'unknown')
  }

  return new NotificationConfigApiError('notificationConfigSaveFailed', 'unknown')
}

function normalizeMutationResult(
  record: NotificationConfigT & { warnings?: Array<string> },
): NotificationConfigMutationResultT {
  const { warnings = [], ...config } = record
  return { record: config, warnings }
}

export async function getNotificationConfigs(
  params?: GetNotificationConfigsParamsT,
): Promise<Array<NotificationConfigT>> {
  const searchParams = new URLSearchParams()

  if (params?.notificationType) {
    searchParams.set('notificationType', params.notificationType)
  }
  if (params?.roleId) {
    searchParams.set('roleId', params.roleId)
  }
  if (params?.active !== undefined) {
    searchParams.set('active', String(params.active))
  }
  if (params?.search?.trim()) {
    searchParams.set('search', params.search.trim())
  }

  const queryString = searchParams.toString()
  const url = `${BASE_PATH}${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<Array<NotificationConfigT>>(url)
  return response.data
}

export async function getNotificationConfig(
  configId: string,
): Promise<NotificationConfigT> {
  const response = await apiClient.get<NotificationConfigT>(
    `${BASE_PATH}/${configId}`,
  )
  return response.data
}

export async function createNotificationConfig(
  payload: CreateNotificationConfigPayloadT,
): Promise<NotificationConfigMutationResultT> {
  try {
    const response = await apiClient.post<
      NotificationConfigT & { warnings?: Array<string> }
    >(BASE_PATH, payload)
    return normalizeMutationResult(response.data)
  } catch (error) {
    throw parseApiError(error)
  }
}

export async function updateNotificationConfig(
  configId: string,
  payload: UpdateNotificationConfigPayloadT,
): Promise<NotificationConfigMutationResultT> {
  try {
    const response = await apiClient.patch<
      NotificationConfigT & { warnings?: Array<string> }
    >(`${BASE_PATH}/${configId}`, payload)
    return normalizeMutationResult(response.data)
  } catch (error) {
    throw parseApiError(error)
  }
}

export async function activateNotificationConfig(
  configId: string,
): Promise<NotificationConfigT> {
  try {
    const response = await apiClient.post<NotificationConfigT>(
      `${BASE_PATH}/${configId}/activate`,
    )
    return response.data
  } catch (error) {
    throw parseApiError(error)
  }
}

export async function deactivateNotificationConfig(
  configId: string,
): Promise<NotificationConfigT> {
  try {
    const response = await apiClient.post<NotificationConfigT>(
      `${BASE_PATH}/${configId}/deactivate`,
    )
    return response.data
  } catch (error) {
    throw parseApiError(error)
  }
}

export async function deleteNotificationConfig(configId: string): Promise<void> {
  try {
    await apiClient.delete(`${BASE_PATH}/${configId}`)
  } catch (error) {
    throw parseApiError(error)
  }
}

export async function getEmailSenderStatus(): Promise<EmailConfigStatusT> {
  const response = await apiClient.get<EmailConfigStatusT>(
    `${BASE_PATH}/email-sender`,
  )
  return response.data
}

export async function upsertEmailSender(
  payload: EmailSenderUpsertPayloadT,
): Promise<EmailConfigStatusT> {
  try {
    const response = await apiClient.put<EmailConfigStatusT>(
      `${BASE_PATH}/email-sender`,
      payload,
    )
    return response.data
  } catch (error) {
    throw parseApiError(error)
  }
}

export async function testEmailSender(
  payload?: EmailSenderTestSendPayloadT,
): Promise<EmailSenderTestSendResultT> {
  try {
    const response = await apiClient.post<EmailSenderTestSendResultT>(
      `${BASE_PATH}/email-sender/test-send`,
      payload ?? {},
    )
    return response.data
  } catch (error) {
    throw parseApiError(error)
  }
}
