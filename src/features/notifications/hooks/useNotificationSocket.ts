import * as React from 'react'

import {
  acquireDossierSocket,
  releaseDossierSocket,
} from '@/features/data-management/lib/dossierSocket'
import { getAccessToken } from '@/features/auth/store'
import { parseNotificationRealtimePayload } from '@/features/notifications/lib/notificationSocket'
import { useNotificationCacheSync } from '@/features/notifications/queries'
import type { NotificationRealtimePayloadT } from '@/features/notifications/types'

type UseNotificationSocketOptionsT = {
  onNotificationNew?: (payload: NotificationRealtimePayloadT) => void
}

export function useNotificationSocket(
  enabled = true,
  options?: UseNotificationSocketOptionsT,
) {
  const { prependRealtimeNotification, refetchNotificationState } =
    useNotificationCacheSync()
  const onNotificationNewRef = React.useRef(options?.onNotificationNew)

  React.useEffect(() => {
    onNotificationNewRef.current = options?.onNotificationNew
  }, [options?.onNotificationNew])

  React.useEffect(() => {
    if (!enabled || !getAccessToken()) return

    const socket = acquireDossierSocket()

    const handleConnect = () => {
      refetchNotificationState()
    }

    const handleNotificationNew = (raw: unknown) => {
      const payload = parseNotificationRealtimePayload(raw)
      if (!payload) return
      prependRealtimeNotification(payload)
      onNotificationNewRef.current?.(payload)
    }

    socket.on('connect', handleConnect)
    socket.on('notification:new', handleNotificationNew)

    if (socket.connected) {
      refetchNotificationState()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('notification:new', handleNotificationNew)
      releaseDossierSocket()
    }
  }, [enabled, prependRealtimeNotification, refetchNotificationState])
}
