import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { getAccessToken } from '@/features/auth/store'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { applyOcrCompleted } from '@/features/data-management/lib/applyOcrCompleted'
import {
  collectOcrWatchDossierIds,
  collectOcrWatchFolderIds,
  resolveSocketRooms,
} from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'
import {
  connectDataManagementSocket,
  disconnectDataManagementSocket,
  joinDossier,
  joinFolder,
  leaveDossier,
  leaveFolder,
  subscribeOcrCompleted,
} from '@/lib/socket/dataManagementSocket'
import type { OcrCompletedPayloadT } from '@/lib/socket/types'

export interface UseDataManagementSocketOptions {
  role: DataManagementRole
  tree: DataTreeNodeT | undefined
  nodeId: string | undefined
  selectedNode: DataTreeNodeT | null
  focusDocumentId: string | undefined
  refreshDossier: (dossierId: string) => Promise<DataTreeNodeT>
  refreshTree: (dossierId?: string) => Promise<DataTreeNodeT>
  loadChildren: (nodeId: string) => Promise<DataTreeNodeT>
  claimNext?: () => Promise<DataTreeNodeT>
}

function resolveWatchFolderIds(
  tree: DataTreeNodeT,
  nodeId: string | undefined,
): Array<string> {
  const ids = new Set<string>()

  for (const folderId of collectOcrWatchFolderIds(tree)) {
    ids.add(folderId)
  }

  const currentRooms = resolveSocketRooms(tree, nodeId)
  if (currentRooms.folderId) ids.add(currentRooms.folderId)

  return [...ids]
}

function resolveWatchDossierIds(
  tree: DataTreeNodeT,
  nodeId: string | undefined,
): Array<string> {
  const ids = new Set<string>()

  for (const dossierId of collectOcrWatchDossierIds(tree)) {
    ids.add(dossierId)
  }

  const currentRooms = resolveSocketRooms(tree, nodeId)
  if (currentRooms.dossierId) ids.add(currentRooms.dossierId)

  return [...ids]
}

export function useDataManagementSocket({
  role,
  tree,
  nodeId,
  selectedNode,
  focusDocumentId,
  refreshDossier,
  refreshTree,
  loadChildren,
  claimNext,
}: UseDataManagementSocketOptions): void {
  const queryClient = useQueryClient()
  const { t } = useTranslation('data-management')
  const joinedFolderIdsRef = useRef<Set<string>>(new Set())
  const joinedDossierIdsRef = useRef<Set<string>>(new Set())

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

  const folderJoinIdsKey = useMemo(
    () => (tree ? resolveWatchFolderIds(tree, nodeId).join('|') : ''),
    [nodeId, tree],
  )
  const dossierJoinIdsKey = useMemo(
    () => (tree ? resolveWatchDossierIds(tree, nodeId).join('|') : ''),
    [nodeId, tree],
  )

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
        refreshDossier: ctx.refreshDossier,
        refreshTree: ctx.refreshTree,
        loadChildren: ctx.loadChildren,
        claimNext: ctx.claimNext,
        t: ctx.t,
      })
    }

    subscribeOcrCompleted(handleOcrCompleted)

    return () => {
      disconnectDataManagementSocket()
      joinedFolderIdsRef.current.clear()
      joinedDossierIdsRef.current.clear()
    }
  }, [enabled, queryClient])

  useEffect(() => {
    if (!enabled || !tree) return

    connectDataManagementSocket()

    const nextFolderIds = new Set(
      folderJoinIdsKey ? folderJoinIdsKey.split('|').filter(Boolean) : [],
    )
    const nextDossierIds = new Set(
      dossierJoinIdsKey ? dossierJoinIdsKey.split('|').filter(Boolean) : [],
    )

    for (const folderId of joinedFolderIdsRef.current) {
      if (!nextFolderIds.has(folderId)) {
        leaveFolder(folderId)
      }
    }
    for (const folderId of nextFolderIds) {
      if (!joinedFolderIdsRef.current.has(folderId)) {
        joinFolder(folderId)
      }
    }

    for (const dossierId of joinedDossierIdsRef.current) {
      if (!nextDossierIds.has(dossierId)) {
        leaveDossier(dossierId)
      }
    }
    for (const dossierId of nextDossierIds) {
      if (!joinedDossierIdsRef.current.has(dossierId)) {
        joinDossier(dossierId)
      }
    }

    joinedFolderIdsRef.current = nextFolderIds
    joinedDossierIdsRef.current = nextDossierIds

    return () => {
      for (const folderId of joinedFolderIdsRef.current) {
        leaveFolder(folderId)
      }
      for (const dossierId of joinedDossierIdsRef.current) {
        leaveDossier(dossierId)
      }
      joinedFolderIdsRef.current.clear()
      joinedDossierIdsRef.current.clear()
    }
  }, [dossierJoinIdsKey, enabled, folderJoinIdsKey, tree])
}
