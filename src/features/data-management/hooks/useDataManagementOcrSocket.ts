import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { Socket } from 'socket.io-client'

import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import {
  acquireDossierSocket,
  logOcrSocketDebug,
  releaseDossierSocket,
} from '@/features/data-management/lib/dossierSocket'
import {
  resolveOcrReloadFolderIds,
  resolveRecordDossierId,
  resolveSocketJoinIds,
  updateDossierStatusInTree,
} from '@/features/data-management/lib/treeUtils'
import { clearLoadedNodeCache } from '@/features/data-management/api/dataManagementClient'
import {
  dataManagementTreeQueryKey,
  useLoadNodeChildrenMutation,
} from '@/features/data-management/queries'
import type {
  DataDossierStatus,
  DataTreeNodeT,
  OcrCompletedEventT,
} from '@/features/data-management/types'
import {
  parseOcrCompletedPayload,
  type OcrCompletedPayloadT,
  type SocketRoomSetsT,
} from '@/lib/socket/types'

const OCR_COMPLETED_DEDUPE_MS = 300
const recentOcrCompletedByDossier = new Map<string, number>()

function shouldSkipDuplicateOcrCompleted(dossierId: string): boolean {
  const now = Date.now()
  const last = recentOcrCompletedByDossier.get(dossierId)
  if (last != null && now - last < OCR_COMPLETED_DEDUPE_MS) return true
  recentOcrCompletedByDossier.set(dossierId, now)
  return false
}

type JoinedRoomsRef = {
  folderIds: Set<string>
  dossierIds: Set<string>
}

function syncSocketRooms(
  socket: Socket,
  joinedRoomsRef: JoinedRoomsRef,
  nextRooms: SocketRoomSetsT,
): void {
  const nextFolderIds = new Set(nextRooms.folderIds)
  const nextDossierIds = new Set(nextRooms.dossierIds)

  for (const folderId of joinedRoomsRef.folderIds) {
    if (!nextFolderIds.has(folderId)) {
      socket.emit('leave:folder', folderId)
      logOcrSocketDebug('emit leave:folder', folderId)
    }
  }

  for (const dossierId of joinedRoomsRef.dossierIds) {
    if (!nextDossierIds.has(dossierId)) {
      socket.emit('leave:dossier', dossierId)
      logOcrSocketDebug('emit leave:dossier', dossierId)
    }
  }

  for (const folderId of nextFolderIds) {
    if (!joinedRoomsRef.folderIds.has(folderId)) {
      socket.emit('join:folder', folderId)
      logOcrSocketDebug('emit join:folder', folderId)
    }
  }

  for (const dossierId of nextDossierIds) {
    if (!joinedRoomsRef.dossierIds.has(dossierId)) {
      socket.emit('join:dossier', dossierId)
      logOcrSocketDebug('emit join:dossier', dossierId)
    }
  }

  joinedRoomsRef.folderIds = nextFolderIds
  joinedRoomsRef.dossierIds = nextDossierIds

  logOcrSocketDebug('rooms', {
    folderJoinIds: [...nextFolderIds],
    dossierJoinIds: [...nextDossierIds],
  })
}

function leaveAllSocketRooms(
  socket: Socket,
  joinedRoomsRef: JoinedRoomsRef,
): void {
  for (const folderId of joinedRoomsRef.folderIds) {
    socket.emit('leave:folder', folderId)
    logOcrSocketDebug('emit leave:folder', folderId)
  }
  for (const dossierId of joinedRoomsRef.dossierIds) {
    socket.emit('leave:dossier', dossierId)
    logOcrSocketDebug('emit leave:dossier', dossierId)
  }
  joinedRoomsRef.folderIds.clear()
  joinedRoomsRef.dossierIds.clear()
}

function isViewingOcrTarget(
  node: DataTreeNodeT | null,
  payload: OcrCompletedPayloadT,
): boolean {
  if (!node) return false

  const recordDossierId = resolveRecordDossierId(node)
  if (recordDossierId && recordDossierId === payload.dossierId) return true
  if (node.id === payload.folderId || node.folderId === payload.folderId) {
    return true
  }
  return false
}

export function useDataManagementOcrSocket({
  role,
  tree,
  selectedNode,
  dossierId,
  extraWatchFolderIds = [],
  extraWatchDossierIds = [],
  enabled,
}: {
  role: DataManagementRole
  tree: DataTreeNodeT | null | undefined
  selectedNode: DataTreeNodeT | null
  dossierId?: string | null
  extraWatchFolderIds?: Array<string>
  extraWatchDossierIds?: Array<string>
  enabled: boolean
}) {
  const { t } = useTranslation('data-management')
  const queryClient = useQueryClient()
  const loadChildrenMutation = useLoadNodeChildrenMutation(role)
  const selectedNodeRef = useRef(selectedNode)
  selectedNodeRef.current = selectedNode

  const { socketRooms, socketRoomsKey } = useMemo(() => {
    const rooms = resolveSocketJoinIds(
      tree ?? null,
      selectedNode,
      dossierId,
      extraWatchFolderIds,
      extraWatchDossierIds,
    )
    const key = `${[...rooms.folderIds].sort().join('|')}::${[...rooms.dossierIds].sort().join('|')}`
    return { socketRooms: rooms, socketRoomsKey: key }
  }, [
    dossierId,
    extraWatchDossierIds,
    extraWatchFolderIds,
    selectedNode,
    tree,
  ])

  const handleOcrCompleted = useCallback(
    async (raw: OcrCompletedEventT) => {
      logOcrSocketDebug('ocr:completed received', raw)

      const payload = parseOcrCompletedPayload(raw)
      if (!payload) {
        logOcrSocketDebug('ignored: invalid payload', raw)
        return
      }

      if (shouldSkipDuplicateOcrCompleted(payload.dossierId)) {
        logOcrSocketDebug('ignored: duplicate event', payload.dossierId)
        return
      }

      const status = payload.status as DataDossierStatus

      queryClient.setQueryData<DataTreeNodeT>(
        dataManagementTreeQueryKey(role),
        (currentTree) => {
          if (!currentTree) return currentTree
          return updateDossierStatusInTree(currentTree, {
            dossierId: payload.dossierId,
            folderId: payload.folderId,
            status,
          })
        },
      )

      const currentTree = queryClient.getQueryData<DataTreeNodeT>(
        dataManagementTreeQueryKey(role),
      )
      const reloadFolderIds = currentTree
        ? resolveOcrReloadFolderIds(currentTree, payload)
        : payload.folderId
          ? [payload.folderId]
          : []

      logOcrSocketDebug('ocr reload folders', reloadFolderIds)

      for (const reloadFolderId of reloadFolderIds) {
        clearLoadedNodeCache(reloadFolderId)
        try {
          await loadChildrenMutation.mutateAsync(reloadFolderId)
        } catch {
          toast.error(t('errors.loadFailed'))
        }
      }

      const currentNode = selectedNodeRef.current
      const viewingTarget = isViewingOcrTarget(currentNode, payload)
      if (
        viewingTarget &&
        status === 'READY_FOR_ENTRY' &&
        currentNode?.type === 'record'
      ) {
        clearLoadedNodeCache(currentNode.id)
        try {
          await loadChildrenMutation.mutateAsync(currentNode.id)
        } catch {
          toast.error(t('errors.loadFailed'))
        }
      }

      if (status === 'READY_FOR_ENTRY') {
        toast.success(t('socket.ocrCompleted'))
        return
      }

      if (status === 'OCR_FAILED') {
        toast.error(t('socket.ocrFailed'))
      }
    },
    [loadChildrenMutation, queryClient, role, t],
  )

  useEffect(() => {
    if (!enabled) return

    const socket = acquireDossierSocket()
    const joinedRoomsRef: JoinedRoomsRef = {
      folderIds: new Set(),
      dossierIds: new Set(),
    }

    const applyRooms = () => {
      syncSocketRooms(socket, joinedRoomsRef, socketRooms)
    }

    const onOcrCompleted = (raw: OcrCompletedEventT) => {
      void handleOcrCompleted(raw)
    }

    socket.on('ocr:completed', onOcrCompleted)
    socket.on('connect', applyRooms)

    if (socket.connected) {
      applyRooms()
    }

    return () => {
      socket.off('ocr:completed', onOcrCompleted)
      socket.off('connect', applyRooms)
      leaveAllSocketRooms(socket, joinedRoomsRef)
      releaseDossierSocket()
    }
  }, [enabled, handleOcrCompleted, socketRooms, socketRoomsKey])
}
