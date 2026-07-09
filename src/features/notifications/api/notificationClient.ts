import type {
  GetNotificationsParamsT,
  MarkAllNotificationsReadResultT,
  NotificationInboxRecordT,
  NotificationUnreadCountT,
} from '@/features/notifications/types'
import { apiClient } from '@/lib/api/apiClient'

const BASE_PATH = '/api/v1/notifications'

export async function getNotifications(
  params?: GetNotificationsParamsT,
): Promise<Array<NotificationInboxRecordT>> {
  const searchParams = new URLSearchParams()

  if (params?.unreadOnly) {
    searchParams.set('unreadOnly', 'true')
  }
  if (params?.limit !== undefined) {
    searchParams.set('limit', String(params.limit))
  }
  if (params?.offset !== undefined) {
    searchParams.set('offset', String(params.offset))
  }

  const queryString = searchParams.toString()
  const url = `${BASE_PATH}${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<Array<NotificationInboxRecordT>>(url)
  return response.data
}

export async function getNotificationUnreadCount(): Promise<number> {
  const response = await apiClient.get<NotificationUnreadCountT>(
    `${BASE_PATH}/unread-count`,
  )
  return response.data.count
}

export async function markNotificationRead(
  notificationId: string,
): Promise<NotificationInboxRecordT> {
  const response = await apiClient.post<NotificationInboxRecordT>(
    `${BASE_PATH}/${notificationId}/read`,
  )
  return response.data
}

export async function markAllNotificationsRead(): Promise<number> {
  const response = await apiClient.post<MarkAllNotificationsReadResultT>(
    `${BASE_PATH}/read-all`,
  )
  return response.data.updatedCount
}
