import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createNotificationConfig,
  deleteNotificationConfig,
  getNotificationConfigs,
  updateNotificationConfig,
  updateNotificationConfigStatus,
} from '@/features/notification-config/api/notificationConfigClient'
import type {
  CreateNotificationConfigPayloadT,
  NotificationConfigMutationWarningT,
  NotificationConfigT,
  NotificationRoleIdT,
  UpdateNotificationConfigPayloadT,
} from '@/features/notification-config/types'
import i18n from '@/lib/i18n/config'

export const notificationConfigsQueryKey = [
  'admin',
  'notification-configs',
] as const

export const notificationConfigsQueryOptions = () =>
  queryOptions({
    queryKey: notificationConfigsQueryKey,
    queryFn: getNotificationConfigs,
    staleTime: 60_000,
  })

function getRoleLabel(roleId: NotificationRoleIdT): string {
  if (roleId === 'editor') {
    return i18n.t('roles.editor', { ns: 'notification-config' })
  }
  if (roleId === 'qc') {
    return i18n.t('roles.qc', { ns: 'notification-config' })
  }
  return i18n.t('roles.admin', { ns: 'notification-config' })
}

function showWarnings(warnings: Array<NotificationConfigMutationWarningT>) {
  warnings.forEach((warning) => {
    toast.warning(
      i18n.t('warnings.roleHasNoActiveUsers', {
        ns: 'notification-config',
        role: getRoleLabel(warning.roleId),
      }),
    )
  })
}

function getErrorMessage(error: Error): string {
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
      queryClient.setQueryData(notificationConfigsQueryKey, (current) => {
        const configs = Array.isArray(current)
          ? (current as Array<NotificationConfigT>)
          : []
        return [result.record, ...configs]
      })
      showWarnings(result.warnings)
      toast.success(
        i18n.t('form.success.create', { ns: 'notification-config' }),
      )
    },
    onError: (error) => {
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
      queryClient.setQueryData(notificationConfigsQueryKey, (current) => {
        const configs = Array.isArray(current)
          ? (current as Array<NotificationConfigT>)
          : []
        return configs.map((config) =>
          config.id === result.record.id ? result.record : config,
        )
      })
      showWarnings(result.warnings)
      toast.success(
        i18n.t('form.success.update', { ns: 'notification-config' }),
      )
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useUpdateNotificationConfigStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ configId, active }: { configId: string; active: boolean }) =>
      updateNotificationConfigStatus(configId, active),
    onSuccess: (record) => {
      queryClient.setQueryData(notificationConfigsQueryKey, (current) => {
        const configs = Array.isArray(current)
          ? (current as Array<NotificationConfigT>)
          : []
        return configs.map((config) =>
          config.id === record.id ? record : config,
        )
      })
      toast.success(
        i18n.t('status.updateSuccess', { ns: 'notification-config' }),
      )
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useDeleteNotificationConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteNotificationConfig,
    onSuccess: (_, configId) => {
      queryClient.setQueryData(notificationConfigsQueryKey, (current) => {
        const configs = Array.isArray(current)
          ? (current as Array<NotificationConfigT>)
          : []
        return configs.filter((config) => config.id !== configId)
      })
      toast.success(i18n.t('delete.success', { ns: 'notification-config' }))
    },
    onError: () => {
      toast.error(i18n.t('delete.error', { ns: 'notification-config' }))
    },
  })
}

