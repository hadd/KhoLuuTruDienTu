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
  collectOcrPendingListingFolderIds,
  findDossierStatusInTree,
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

const OCR_COMPLETED_DEDUPE_MS = 500
const RELOAD_DEBOUNCE_MS = 300
const RELOAD_CONCURRENCY = 4
const OCR_POLL_INTERVAL_MS = 10_000
const SOCKET_JOIN_ACK_TIMEOUT_MS = 5000
const recentOcrCompletedByDossier = new Map<string, number>()

function shouldSkipDuplicateOcrCompleted(dossierId: string): boolean {
  const now = Date.now()
  const last = recentOcrCompletedByDossier.get(dossierId)
  if (last != null && now - last < OCR_COMPLETED_DEDUPE_MS) return true
  recentOcrCompletedByDossier.set(dossierId, now)
  return false
}

async function mapWithConcurrency<T, R>(
  items: Array<T>,
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<Array<R>> {
  const results: Array<R> = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index]!, index)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}

type JoinedRoomsRef = {
  folderIds: Set<string>
  dossierIds: Set<string>
}

type ReloadBatchRef = {
  timer: ReturnType<typeof setTimeout> | null
  nodeIds: Set<string>
  showSuccessToast: boolean
  showFailureToast: boolean
}

function clearJoinedRoomsRef(joinedRoomsRef: JoinedRoomsRef): void {
  joinedRoomsRef.folderIds.clear()
  joinedRoomsRef.dossierIds.clear()
}

function syncSocketRooms(
  socket: Socket,
  joinedRoomsRef: JoinedRoomsRef,
  nextRooms: SocketRoomSetsT,
): void {
  if (!socket.connected) {
    logOcrSocketDebug('defer room sync until connected')
    return
  }

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
      socket
        .timeout(SOCKET_JOIN_ACK_TIMEOUT_MS)
        .emit('join:folder', folderId, (err, ack?: unknown) => {
          if (err) {
            logOcrSocketDebug('join:folder ack timeout', { folderId, err })
            return
          }
          logOcrSocketDebug('join:folder ack', { folderId, ack })
        })
      logOcrSocketDebug('emit join:folder', folderId)
    }
  }

  for (const dossierId of nextDossierIds) {
    if (!joinedRoomsRef.dossierIds.has(dossierId)) {
      socket
        .timeout(SOCKET_JOIN_ACK_TIMEOUT_MS)
        .emit('join:dossier', dossierId, (err, ack?: unknown) => {
          if (err) {
            logOcrSocketDebug('join:dossier ack timeout', { dossierId, err })
            return
          }
          logOcrSocketDebug('join:dossier ack', { dossierId, ack })
        })
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

  const reloadBatchRef = useRef<ReloadBatchRef>({
    timer: null,
    nodeIds: new Set(),
    showSuccessToast: false,
    showFailureToast: false,
  })

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

  const { pendingFolderIds, pendingFolderIdsKey } = useMemo(() => {
    const folderIds = tree ? collectOcrPendingListingFolderIds(tree) : []
    return {
      pendingFolderIds: folderIds,
      pendingFolderIdsKey: [...folderIds].sort().join('|'),
    }
  }, [tree])

  const pendingFolderIdsRef = useRef(pendingFolderIds)
  pendingFolderIdsRef.current = pendingFolderIds

  const flushReloadBatch = useCallback(async () => {
    const batch = reloadBatchRef.current
    batch.timer = null

    const nodeIds = [...batch.nodeIds]
    const showSuccessToast = batch.showSuccessToast
    const showFailureToast = batch.showFailureToast

    batch.nodeIds.clear()
    batch.showSuccessToast = false
    batch.showFailureToast = false

    if (nodeIds.length === 0) {
      if (showSuccessToast) toast.success(t('socket.ocrCompleted'))
      if (showFailureToast) toast.error(t('socket.ocrFailed'))
      return
    }

    const startedAt = performance.now()
    logOcrSocketDebug('reload batch start', { nodeIds })

    let hadLoadError = false
    await mapWithConcurrency(nodeIds, RELOAD_CONCURRENCY, async (nodeId) => {
      clearLoadedNodeCache(nodeId)
      try {
        await loadChildrenMutation.mutateAsync(nodeId)
      } catch {
        hadLoadError = true
      }
    })

    logOcrSocketDebug('reload batch done', {
      ms: Math.round(performance.now() - startedAt),
      nodeIds,
      hadLoadError,
    })

    if (hadLoadError) {
      toast.error(t('errors.loadFailed'))
    }
    if (showSuccessToast) toast.success(t('socket.ocrCompleted'))
    if (showFailureToast) toast.error(t('socket.ocrFailed'))
  }, [loadChildrenMutation, t])

  const flushReloadBatchRef = useRef(flushReloadBatch)
  flushReloadBatchRef.current = flushReloadBatch

  const reloadFolderIdsSilently = useCallback(
    async (nodeIds: Array<string>) => {
      if (nodeIds.length === 0) return

      const startedAt = performance.now()
      logOcrSocketDebug('poll reload start', { nodeIds })

      await mapWithConcurrency(nodeIds, RELOAD_CONCURRENCY, async (nodeId) => {
        clearLoadedNodeCache(nodeId)
        try {
          await loadChildrenMutation.mutateAsync(nodeId)
        } catch {
          logOcrSocketDebug('poll reload failed', { nodeId })
        }
      })

      logOcrSocketDebug('poll reload done', {
        ms: Math.round(performance.now() - startedAt),
        nodeIds,
      })
    },
    [loadChildrenMutation],
  )

  const reloadFolderIdsSilentlyRef = useRef(reloadFolderIdsSilently)
  reloadFolderIdsSilentlyRef.current = reloadFolderIdsSilently

  const scheduleReloadBatch = useCallback(
    (nodeIds: Array<string>, status: DataDossierStatus) => {
      const batch = reloadBatchRef.current
      for (const nodeId of nodeIds) {
        batch.nodeIds.add(nodeId)
      }

      if (status === 'READY_FOR_ENTRY') {
        batch.showSuccessToast = true
      } else if (status === 'OCR_FAILED') {
        batch.showFailureToast = true
      }

      if (batch.timer != null) {
        clearTimeout(batch.timer)
      }

      batch.timer = setTimeout(() => {
        void flushReloadBatchRef.current()
      }, RELOAD_DEBOUNCE_MS)
    },
    [],
  )

  const handleOcrCompleted = useCallback(
    (raw: OcrCompletedEventT) => {
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

      const treeBeforeUpdate = queryClient.getQueryData<DataTreeNodeT>(
        dataManagementTreeQueryKey(role),
      )
      const previousStatus = treeBeforeUpdate
        ? findDossierStatusInTree(treeBeforeUpdate, {
            dossierId: payload.dossierId,
            folderId: payload.folderId,
          })
        : null

      if (previousStatus != null && previousStatus === status) {
        logOcrSocketDebug('ignored: status unchanged', {
          dossierId: payload.dossierId,
          status,
        })
        return
      }

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

      logOcrSocketDebug('ocr reload folders queued', reloadFolderIds)

      const reloadNodeIds = new Set(reloadFolderIds)
      const currentNode = selectedNodeRef.current
      const viewingTarget = isViewingOcrTarget(currentNode, payload)
      if (
        viewingTarget &&
        status === 'READY_FOR_ENTRY' &&
        currentNode?.type === 'record'
      ) {
        reloadNodeIds.add(currentNode.id)
      }

      scheduleReloadBatch([...reloadNodeIds], status)
    },
    [queryClient, role, scheduleReloadBatch],
  )

  const handleOcrCompletedRef = useRef(handleOcrCompleted)
  handleOcrCompletedRef.current = handleOcrCompleted

  const socketRoomsRef = useRef(socketRooms)
  socketRoomsRef.current = socketRooms

  const joinedRoomsRef = useRef<JoinedRoomsRef>({
    folderIds: new Set(),
    dossierIds: new Set(),
  })
  const socketInstanceRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!enabled) return

    const socket = acquireDossierSocket()
    socketInstanceRef.current = socket

    const applyRooms = () => {
      clearJoinedRoomsRef(joinedRoomsRef.current)
      syncSocketRooms(
        socket,
        joinedRoomsRef.current,
        socketRoomsRef.current,
      )
    }

    const onDisconnect = () => {
      clearJoinedRoomsRef(joinedRoomsRef.current)
    }

    const onOcrCompleted = (raw: OcrCompletedEventT) => {
      handleOcrCompletedRef.current(raw)
    }

    socket.on('ocr:completed', onOcrCompleted)
    socket.on('connect', applyRooms)
    socket.on('disconnect', onDisconnect)

    if (socket.connected) {
      applyRooms()
    }

    return () => {
      const batch = reloadBatchRef.current
      if (batch.timer != null) {
        clearTimeout(batch.timer)
        batch.timer = null
      }

      socket.off('ocr:completed', onOcrCompleted)
      socket.off('connect', applyRooms)
      socket.off('disconnect', onDisconnect)
      leaveAllSocketRooms(socket, joinedRoomsRef.current)
      socketInstanceRef.current = null
      releaseDossierSocket()
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const socket = socketInstanceRef.current ?? acquireDossierSocket()
    syncSocketRooms(socket, joinedRoomsRef.current, socketRoomsRef.current)
  }, [enabled, socketRoomsKey])

  useEffect(() => {
    if (!enabled || pendingFolderIdsKey.length === 0) return

    const pollPendingFolders = () => {
      const nodeIds = pendingFolderIdsRef.current
      if (nodeIds.length === 0) return
      void reloadFolderIdsSilentlyRef.current(nodeIds)
    }

    pollPendingFolders()
    const intervalId = setInterval(pollPendingFolders, OCR_POLL_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [enabled, pendingFolderIdsKey])
}
