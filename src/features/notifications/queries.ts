import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import {
  getNotificationUnreadCount,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/api/notificationClient'
import type {
  GetNotificationsParamsT,
  NotificationInboxRecordT,
  NotificationRealtimePayloadT,
} from '@/features/notifications/types'

export const NOTIFICATION_LIST_LIMIT = 20

export const notificationUnreadCountQueryKey = [
  'notifications',
  'unread-count',
] as const

export const notificationsListQueryKey = (params?: GetNotificationsParamsT) =>
  ['notifications', 'list', params ?? {}] as const

export const notificationUnreadCountQueryOptions = () =>
  queryOptions({
    queryKey: notificationUnreadCountQueryKey,
    queryFn: getNotificationUnreadCount,
    staleTime: 30_000,
  })

export const notificationsListQueryOptions = (
  params?: GetNotificationsParamsT,
) =>
  queryOptions({
    queryKey: notificationsListQueryKey(params),
    queryFn: () => getNotifications(params),
    staleTime: 30_000,
  })

function prependNotificationToList(
  current: unknown,
  notification: NotificationInboxRecordT,
): Array<NotificationInboxRecordT> {
  const items = Array.isArray(current)
    ? (current as Array<NotificationInboxRecordT>)
    : []

  if (items.some((item) => item.id === notification.id)) {
    return items
  }

  return [notification, ...items].slice(0, NOTIFICATION_LIST_LIMIT)
}

export function realtimePayloadToInboxRecord(
  payload: NotificationRealtimePayloadT,
): NotificationInboxRecordT {
  return {
    ...payload,
    payload: null,
    readAt: null,
  }
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (record) => {
      queryClient.setQueryData(
        notificationsListQueryKey({ limit: NOTIFICATION_LIST_LIMIT }),
        (current) => {
          const items = Array.isArray(current)
            ? (current as Array<NotificationInboxRecordT>)
            : []
          return items.map((item) => (item.id === record.id ? record : item))
        },
      )
      queryClient.setQueryData(
        notificationUnreadCountQueryKey,
        (current: number | undefined) => Math.max(0, (current ?? 1) - 1),
      )
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.setQueryData(notificationUnreadCountQueryKey, 0)
      queryClient.setQueryData(
        notificationsListQueryKey({ limit: NOTIFICATION_LIST_LIMIT }),
        (current) => {
          const items = Array.isArray(current)
            ? (current as Array<NotificationInboxRecordT>)
            : []
          return items.map((item) => ({
            ...item,
            readAt: item.readAt ?? new Date().toISOString(),
          }))
        },
      )
    },
  })
}

export function useNotificationCacheSync() {
  const queryClient = useQueryClient()

  return {
    prependRealtimeNotification(payload: NotificationRealtimePayloadT) {
      const record = realtimePayloadToInboxRecord(payload)

      queryClient.setQueryData(
        notificationsListQueryKey({ limit: NOTIFICATION_LIST_LIMIT }),
        (current) => prependNotificationToList(current, record),
      )

      queryClient.setQueryData(
        notificationUnreadCountQueryKey,
        (current: number | undefined) => (current ?? 0) + 1,
      )
    },
    refetchNotificationState() {
      void queryClient.invalidateQueries({
        queryKey: notificationUnreadCountQueryKey,
      })
      void queryClient.invalidateQueries({
        queryKey: ['notifications', 'list'],
      })
    },
  }
}
