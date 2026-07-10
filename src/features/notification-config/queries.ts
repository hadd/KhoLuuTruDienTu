import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  activateNotificationConfig,
  createNotificationConfig,
  deactivateNotificationConfig,
  deleteNotificationConfig,
  getEmailSenderStatus,
  getNotificationConfigs,
  NotificationConfigApiError,
  testEmailSender,
  updateNotificationConfig,
  upsertEmailSender,
} from '@/features/notification-config/api/notificationConfigClient'
import type {
  CreateNotificationConfigPayloadT,
  EmailSenderTestSendPayloadT,
  EmailSenderUpsertPayloadT,
  GetNotificationConfigsParamsT,
  UpdateNotificationConfigPayloadT,
} from '@/features/notification-config/types'
import i18n from '@/lib/i18n/config'

export const notificationConfigsQueryKey = [
  'admin',
  'notification-configs',
] as const

export const emailSenderQueryKey = ['admin', 'email-sender'] as const

export const emailSenderQueryOptions = () =>
  queryOptions({
    queryKey: emailSenderQueryKey,
    queryFn: getEmailSenderStatus,
    staleTime: 60_000,
  })

export const notificationConfigsQueryOptions = (
  params?: GetNotificationConfigsParamsT,
) =>
  queryOptions({
    queryKey: [...notificationConfigsQueryKey, params ?? {}] as const,
    queryFn: () => getNotificationConfigs(params),
    staleTime: 60_000,
  })

function showWarnings(warnings: Array<string>) {
  warnings.forEach((warning) => {
    toast.warning(warning)
  })
}

function getErrorMessage(error: Error): string {
  if (error instanceof NotificationConfigApiError) {
    if (error.code === 'duplicate') {
      return i18n.t('errors.duplicateConfig', { ns: 'notification-config' })
    }
    if (error.code === 'notFound') {
      return i18n.t('errors.notFound', { ns: 'notification-config' })
    }
    if (error.code === 'unknownRoles') {
      return i18n.t('errors.unknownRoles', { ns: 'notification-config' })
    }
    if (error.code === 'validation' && error.details) {
      return error.details
    }
  }

  if (error.message === 'notificationConfigDuplicate') {
    return i18n.t('errors.duplicateConfig', { ns: 'notification-config' })
  }

  if (error.message === 'notificationConfigNotFound') {
    return i18n.t('errors.notFound', { ns: 'notification-config' })
  }

  return i18n.t('errors.saveFailed', { ns: 'notification-config' })
}

export function useCreateNotificationConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateNotificationConfigPayloadT) =>
      createNotificationConfig(payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: notificationConfigsQueryKey })
      showWarnings(result.warnings)
      toast.success(
        i18n.t('form.success.create', { ns: 'notification-config' }),
      )
    },
    onError: (error: Error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useUpdateNotificationConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      configId,
      payload,
    }: {
      configId: string
      payload: UpdateNotificationConfigPayloadT
    }) => updateNotificationConfig(configId, payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: notificationConfigsQueryKey })
      showWarnings(result.warnings)
      toast.success(
        i18n.t('form.success.update', { ns: 'notification-config' }),
      )
    },
    onError: (error: Error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useUpdateNotificationConfigStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ configId, active }: { configId: string; active: boolean }) =>
      active
        ? activateNotificationConfig(configId)
        : deactivateNotificationConfig(configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationConfigsQueryKey })
      toast.success(
        i18n.t('status.updateSuccess', { ns: 'notification-config' }),
      )
    },
    onError: (error: Error) => {
      if (
        error instanceof NotificationConfigApiError &&
        error.code === 'validation' &&
        /email channel/i.test(error.details ?? error.message)
      ) {
        toast.error(
          i18n.t('errors.activateEmailNotReady', { ns: 'notification-config' }),
        )
        document
          .getElementById('email-sender-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      toast.error(getErrorMessage(error))
    },
  })
}

export function useDeleteNotificationConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteNotificationConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationConfigsQueryKey })
      toast.success(i18n.t('delete.success', { ns: 'notification-config' }))
    },
    onError: () => {
      toast.error(i18n.t('delete.error', { ns: 'notification-config' }))
    },
  })
}

export function useUpsertEmailSender() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: EmailSenderUpsertPayloadT) => upsertEmailSender(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailSenderQueryKey })
      queryClient.invalidateQueries({ queryKey: notificationConfigsQueryKey })
      toast.success(
        i18n.t('emailSender.form.success.save', { ns: 'notification-config' }),
      )
    },
    onError: (error: Error) => {
      toast.error(getEmailMessage(error))
    },
  })
}

export function useTestEmailSender() {
  return useMutation({
    mutationFn: (payload?: EmailSenderTestSendPayloadT) => testEmailSender(payload),
    onSuccess: (result) => {
      toast.success(
        i18n.t('emailSender.form.success.testSend', {
          ns: 'notification-config',
          email: result.sentTo,
        }),
      )
    },
    onError: (error: Error) => {
      toast.error(getEmailMessage(error))
    },
  })
}

function getEmailMessage(error: Error): string {
  if (error instanceof NotificationConfigApiError) {
    if (error.code === 'validation' && error.details) {
      return error.details
    }
  }
  return i18n.t('emailSender.errors.saveFailed', { ns: 'notification-config' })
}
