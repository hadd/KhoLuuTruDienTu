import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import {
  acquireDossierSocket,
  releaseDossierSocket,
} from '@/features/data-management/lib/dossierSocket'
import {
  pendingManualDossiersQueryKeyPrefix,
  trackedManualDossiersQueryKeyPrefix,
} from '@/features/ocr-control/queries'
import { parseOcrCompletedPayload } from '@/lib/socket/types'

export function useOcrControlSocket(enabled: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return

    const socket = acquireDossierSocket()

    const onOcrEvent = (raw: unknown) => {
      const payload = parseOcrCompletedPayload(raw)
      if (!payload) return

      void queryClient.invalidateQueries({
        queryKey: trackedManualDossiersQueryKeyPrefix,
      })
      void queryClient.invalidateQueries({
        queryKey: pendingManualDossiersQueryKeyPrefix,
      })
    }

    socket.on('ocr:completed', onOcrEvent)

    return () => {
      socket.off('ocr:completed', onOcrEvent)
      releaseDossierSocket()
    }
  }, [enabled, queryClient])
}
