import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { getAccessToken } from '@/features/auth/store'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { applyOcrCompleted } from '@/features/data-management/lib/applyOcrCompleted'
import { resolveSocketJoinIds } from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'
import {
  acquireDataManagementSocket,
  releaseDataManagementSocket,
  subscribeOcrCompleted,
  syncDataManagementSocketRoomSets,
  unsubscribeOcrCompleted,
} from '@/lib/socket/dataManagementSocket'
import type { OcrCompletedPayloadT, SocketRoomSetsT } from '@/lib/socket/types'
import { roomSetsEqual } from '@/lib/socket/types'

export interface UseDataManagementSocketOptions {
  role: DataManagementRole
  tree: DataTreeNodeT | undefined
  nodeId: string | undefined
  selectedNode: DataTreeNodeT | null
  focusDocumentId: string | undefined
  dossierId?: string | null
  refreshDossier: (dossierId: string) => Promise<DataTreeNodeT>
  refreshTree: (dossierId?: string) => Promise<DataTreeNodeT>
  loadChildren: (nodeId: string) => Promise<DataTreeNodeT>
  claimNext?: () => Promise<DataTreeNodeT>
  extraWatchFolderIds?: Array<string>
  extraWatchDossierIds?: Array<string>
}

export function useDataManagementSocket({
  role,
  tree,
  nodeId,
  selectedNode,
  focusDocumentId,
  dossierId,
  refreshDossier,
  refreshTree,
  loadChildren,
  claimNext,
  extraWatchFolderIds = [],
  extraWatchDossierIds = [],
}: UseDataManagementSocketOptions): void {
  const queryClient = useQueryClient()
  const { t } = useTranslation('data-management')
  const roomsRef = useRef<SocketRoomSetsT>({ folderIds: [], dossierIds: [] })

  const contextRef = useRef({
    role,
    tree,
    nodeId,
    selectedNode,
    focusDocumentId,
    refreshDossier,
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
    refreshDossier,
    refreshTree,
    loadChildren,
    claimNext,
    t,
  }

  const enabled = Boolean(tree && getAccessToken())

  const joinIds = useMemo(
    () =>
      resolveSocketJoinIds(
        tree ?? null,
        selectedNode,
        dossierId,
        extraWatchFolderIds,
        extraWatchDossierIds,
      ),
    [
      dossierId,
      extraWatchDossierIds,
      extraWatchFolderIds,
      selectedNode,
      tree,
    ],
  )
  const joinIdsKey = `${joinIds.folderIds.join('|')}::${joinIds.dossierIds.join('|')}`

  useEffect(() => {
    if (!enabled) return

    acquireDataManagementSocket()

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
        refreshDossier: ctx.refreshDossier,
        refreshTree: ctx.refreshTree,
        loadChildren: ctx.loadChildren,
        claimNext: ctx.claimNext,
        t: ctx.t,
      })
    }

    subscribeOcrCompleted(handleOcrCompleted)

    return () => {
      unsubscribeOcrCompleted()
      releaseDataManagementSocket()
    }
  }, [enabled, queryClient])

  useEffect(() => {
    if (!enabled || !tree) return
    if (roomSetsEqual(roomsRef.current, joinIds)) return

    roomsRef.current = joinIds
    syncDataManagementSocketRoomSets(joinIds)
  }, [enabled, joinIds, joinIdsKey, tree])
}
