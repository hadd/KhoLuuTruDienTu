import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { getAccessToken } from '@/features/auth/store'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { applyOcrCompleted } from '@/features/data-management/lib/applyOcrCompleted'
import { resolveSocketRooms } from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'
import {
  connectDataManagementSocket,
  disconnectDataManagementSocket,
  subscribeOcrCompleted,
  syncDataManagementSocketRooms,
} from '@/lib/socket/dataManagementSocket'
import {
  roomsEqual,
  type OcrCompletedPayloadT,
  type SocketRoomsT,
} from '@/lib/socket/types'

export interface UseDataManagementSocketOptions {
  role: DataManagementRole
  tree: DataTreeNodeT | undefined
  nodeId: string | undefined
  selectedNode: DataTreeNodeT | null
  focusDocumentId: string | undefined
  refreshTree: (dossierId?: string) => Promise<DataTreeNodeT>
  loadChildren: (nodeId: string) => Promise<DataTreeNodeT>
  claimNext?: () => Promise<DataTreeNodeT>
}

export function useDataManagementSocket({
  role,
  tree,
  nodeId,
  selectedNode,
  focusDocumentId,
  refreshTree,
  loadChildren,
  claimNext,
}: UseDataManagementSocketOptions): void {
  const queryClient = useQueryClient()
  const { t } = useTranslation('data-management')
  const roomsRef = useRef<SocketRoomsT>({ folderId: null, dossierId: null })

  const contextRef = useRef({
    role,
    tree,
    nodeId,
    selectedNode,
    focusDocumentId,
    refreshTree,
    loadChildren,
    claimNext,
    t,
  })
  contextRef.current = {
    role,
    tree,
    nodeId,
    selectedNode,
    focusDocumentId,
    refreshTree,
    loadChildren,
    claimNext,
    t,
  }

  const enabled = Boolean(tree && getAccessToken())

  useEffect(() => {
    if (!enabled) return

    connectDataManagementSocket()

    const handleOcrCompleted = (payload: OcrCompletedPayloadT) => {
      const ctx = contextRef.current
      if (!ctx.tree) return
      void applyOcrCompleted({
        queryClient,
        role: ctx.role,
        payload,
        nodeId: ctx.nodeId,
        selectedNode: ctx.selectedNode,
        focusDocumentId: ctx.focusDocumentId,
        refreshTree: ctx.refreshTree,
        loadChildren: ctx.loadChildren,
        claimNext: ctx.claimNext,
        t: ctx.t,
      })
    }

    subscribeOcrCompleted(handleOcrCompleted)

    return () => {
      disconnectDataManagementSocket()
    }
  }, [enabled, queryClient])

  useEffect(() => {
    if (!enabled || !tree) return

    const nextRooms = resolveSocketRooms(tree, nodeId)
    if (roomsEqual(roomsRef.current, nextRooms)) return

    roomsRef.current = nextRooms
    syncDataManagementSocketRooms(nextRooms)
  }, [enabled, tree, nodeId])
}
