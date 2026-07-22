import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'

import {
  getNotificationUnreadCount,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/api/notificationClient'
import type {
  NotificationInboxRecordT,
  NotificationRealtimePayloadT,
} from '@/features/notifications/types'

export const NOTIFICATION_LIST_LIMIT = 20

export type NotificationsInfiniteDataT = InfiniteData<
  Array<NotificationInboxRecordT>,
  number
>

export type NotificationsListFiltersT = {
  unreadOnly?: boolean
}

export const notificationUnreadCountQueryKey = [
  'notifications',
  'unread-count',
] as const

export const notificationsListQueryKey = (
  params?: NotificationsListFiltersT,
) =>
  [
    'notifications',
    'list',
    {
      limit: NOTIFICATION_LIST_LIMIT,
      unreadOnly: params?.unreadOnly,
    },
  ] as const

export const notificationUnreadCountQueryOptions = () =>
  queryOptions({
    queryKey: notificationUnreadCountQueryKey,
    queryFn: getNotificationUnreadCount,
    staleTime: 30_000,
  })

export const notificationsInfiniteQueryOptions = (
  params?: NotificationsListFiltersT,
) =>
  infiniteQueryOptions({
    queryKey: notificationsListQueryKey(params),
    queryFn: ({ pageParam }) =>
      getNotifications({
        unreadOnly: params?.unreadOnly,
        limit: NOTIFICATION_LIST_LIMIT,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < NOTIFICATION_LIST_LIMIT) {
        return undefined
      }

      return allPages.reduce((total, page) => total + page.length, 0)
    },
    staleTime: 30_000,
  })

function mapInfiniteNotifications(
  current: NotificationsInfiniteDataT | undefined,
  mapper: (item: NotificationInboxRecordT) => NotificationInboxRecordT,
): NotificationsInfiniteDataT | undefined {
  if (!current) return current

  return {
    ...current,
    pages: current.pages.map((page) => page.map(mapper)),
  }
}

function prependNotificationToInfinite(
  current: NotificationsInfiniteDataT | undefined,
  notification: NotificationInboxRecordT,
): NotificationsInfiniteDataT {
  if (!current || current.pages.length === 0) {
    return {
      pages: [[notification]],
      pageParams: [0],
    }
  }

  const firstPage = current.pages[0] ?? []
  if (firstPage.some((item) => item.id === notification.id)) {
    return current
  }

  return {
    ...current,
    pages: [[notification, ...firstPage], ...current.pages.slice(1)],
  }
}

export function realtimePayloadToInboxRecord(
  payload: NotificationRealtimePayloadT,
): NotificationInboxRecordT {
  return {
    ...payload,
    readAt: null,
  }
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (record) => {
      queryClient.setQueryData<NotificationsInfiniteDataT>(
        notificationsListQueryKey(),
        (current) =>
          mapInfiniteNotifications(current, (item) =>
            item.id === record.id ? record : item,
          ),
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
      queryClient.setQueryData<NotificationsInfiniteDataT>(
        notificationsListQueryKey(),
        (current) =>
          mapInfiniteNotifications(current, (item) => ({
            ...item,
            readAt: item.readAt ?? new Date().toISOString(),
          })),
      )
    },
  })
}

export function useNotificationCacheSync() {
  const queryClient = useQueryClient()

  return {
    prependRealtimeNotification(payload: NotificationRealtimePayloadT) {
      const record = realtimePayloadToInboxRecord(payload)

      queryClient.setQueryData<NotificationsInfiniteDataT>(
        notificationsListQueryKey(),
        (current) => prependNotificationToInfinite(current, record),
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
