import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'

import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import {
  acquireDossierSocket,
  logOcrSocketDebug,
  releaseDossierSocket,
} from '@/features/data-management/lib/dossierSocket'
import {
  collectOcrPendingListingFolderIds,
  excludeStableViewingFromReload,
  filterOcrReloadFolderIds,
  findDossierStatusInTree,
  resolveOcrReloadFolderIds,
  resolveRecordDossierId,
  resolveSocketJoinIds,
  updateDossierStatusInTree,
} from '@/features/data-management/lib/treeUtils'
import {
  dataManagementTreeQueryKey,
  useLoadNodeChildrenMutation,
} from '@/features/data-management/queries'
import type {
  DataDossierStatus,
  DataTreeNodeT,
  OcrCompletedEventT,
} from '@/features/data-management/types'
import type { OcrCompletedPayloadT, SocketRoomSetsT } from '@/lib/socket/types'
import { parseOcrCompletedPayload } from '@/lib/socket/types'

const OCR_COMPLETED_DEDUPE_MS = 500
const RELOAD_DEBOUNCE_MS = 300
const RELOAD_CONCURRENCY = 4
const OCR_POLL_BASE_INTERVAL_MS = 10_000
const OCR_POLL_MAX_INTERVAL_MS = 60_000
const RECENTLY_RELOADED_TTL_MS = 5_000
const MAP_ENTRY_MAX_AGE_MS = 60 * 60 * 1000
const MAP_PRUNE_INTERVAL_MS = 5 * 60 * 1000
const SOCKET_JOIN_ACK_TIMEOUT_MS = 5000
const SOCKET_JOIN_CONCURRENCY = 8
const OCR_TERMINAL_RELOAD_STATUSES = new Set<DataDossierStatus>([
  'READY_FOR_ENTRY',
  'OCR_FAILED',
])
const recentOcrCompletedByDossier = new Map<string, number>()
const recentlyReloadedFolderIds = new Map<string, number>()
let lastMapPruneAt = 0

function pruneExpiredMapEntries(
  map: Map<string, number>,
  maxAgeMs: number,
): void {
  const now = Date.now()
  if (now - lastMapPruneAt < MAP_PRUNE_INTERVAL_MS) return
  lastMapPruneAt = now

  for (const [key, timestamp] of map) {
    if (now - timestamp > maxAgeMs) {
      map.delete(key)
    }
  }
}

function markRecentlyReloaded(nodeIds: Array<string>): void {
  const now = Date.now()
  for (const nodeId of nodeIds) {
    recentlyReloadedFolderIds.set(nodeId, now)
  }
  pruneExpiredMapEntries(recentlyReloadedFolderIds, MAP_ENTRY_MAX_AGE_MS)
}

function filterRecentlyReloaded(nodeIds: Array<string>): Array<string> {
  const now = Date.now()
  return nodeIds.filter((nodeId) => {
    const reloadedAt = recentlyReloadedFolderIds.get(nodeId)
    if (reloadedAt != null && now - reloadedAt < RECENTLY_RELOADED_TTL_MS) {
      return false
    }
    return true
  })
}

function shouldSkipDuplicateOcrCompleted(dossierId: string): boolean {
  const now = Date.now()
  const last = recentOcrCompletedByDossier.get(dossierId)
  if (last != null && now - last < OCR_COMPLETED_DEDUPE_MS) return true
  recentOcrCompletedByDossier.set(dossierId, now)
  pruneExpiredMapEntries(recentOcrCompletedByDossier, MAP_ENTRY_MAX_AGE_MS)
  return false
}

async function mapWithConcurrency<TItem, TResult>(
  items: Array<TItem>,
  concurrency: number,
  mapper: (item: TItem, index: number) => Promise<TResult>,
): Promise<Array<TResult>> {
  const results: Array<TResult> = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      const item = items[index]
      if (item === undefined) continue
      results[index] = await mapper(item, index)
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
  optimisticApplied: boolean
  payload?: OcrCompletedPayloadT
}

type PendingSocketJoinT = {
  type: 'folder' | 'dossier'
  id: string
}

type ReloadFoldersOptionsT = {
  payload?: OcrCompletedPayloadT
  showSuccessToast?: boolean
  showFailureToast?: boolean
  optimisticApplied?: boolean
  logLabel: string
}

function clearJoinedRoomsRef(joinedRoomsRef: JoinedRoomsRef): void {
  joinedRoomsRef.folderIds.clear()
  joinedRoomsRef.dossierIds.clear()
}

function emitSocketJoin(
  socket: Socket,
  join: PendingSocketJoinT,
): Promise<void> {
  return new Promise((resolve) => {
    if (join.type === 'folder') {
      socket
        .timeout(SOCKET_JOIN_ACK_TIMEOUT_MS)
        .emit(
          'join:folder',
          join.id,
          (err: Error | undefined, ack?: unknown) => {
            if (err) {
              logOcrSocketDebug('join:folder ack timeout', {
                folderId: join.id,
                err,
              })
            } else {
              logOcrSocketDebug('join:folder ack', { folderId: join.id, ack })
            }
            resolve()
          },
        )
      logOcrSocketDebug('emit join:folder', join.id)
      return
    }

    socket
      .timeout(SOCKET_JOIN_ACK_TIMEOUT_MS)
      .emit(
        'join:dossier',
        join.id,
        (err: Error | undefined, ack?: unknown) => {
          if (err) {
            logOcrSocketDebug('join:dossier ack timeout', {
              dossierId: join.id,
              err,
            })
          } else {
            logOcrSocketDebug('join:dossier ack', { dossierId: join.id, ack })
          }
          resolve()
        },
      )
    logOcrSocketDebug('emit join:dossier', join.id)
  })
}

let joinQueueGeneration = 0

async function emitThrottledSocketJoins(
  socket: Socket,
  joins: Array<PendingSocketJoinT>,
  generation: number,
): Promise<void> {
  if (joins.length === 0) return

  await mapWithConcurrency(joins, SOCKET_JOIN_CONCURRENCY, async (join) => {
    if (generation !== joinQueueGeneration) return
    if (!socket.connected) return
    await emitSocketJoin(socket, join)
  })
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

  const pendingJoins: Array<PendingSocketJoinT> = []

  for (const folderId of nextFolderIds) {
    if (!joinedRoomsRef.folderIds.has(folderId)) {
      pendingJoins.push({ type: 'folder', id: folderId })
    }
  }

  for (const dossierId of nextDossierIds) {
    if (!joinedRoomsRef.dossierIds.has(dossierId)) {
      pendingJoins.push({ type: 'dossier', id: dossierId })
    }
  }

  joinedRoomsRef.folderIds = nextFolderIds
  joinedRoomsRef.dossierIds = nextDossierIds

  logOcrSocketDebug('rooms', {
    folderJoinIds: [...nextFolderIds],
    dossierJoinIds: [...nextDossierIds],
    pendingJoins: pendingJoins.length,
  })

  if (pendingJoins.length === 0) return

  joinQueueGeneration += 1
  const generation = joinQueueGeneration
  void emitThrottledSocketJoins(socket, pendingJoins, generation)
}

function leaveAllSocketRooms(
  socket: Socket,
  joinedRoomsRef: JoinedRoomsRef,
): void {
  joinQueueGeneration += 1

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

function resolveReloadFolderIds(
  tree: DataTreeNodeT | null,
  folderIds: Array<string>,
  selectedNode: DataTreeNodeT | null,
  payload?: OcrCompletedPayloadT,
): Array<string> {
  if (!tree || folderIds.length === 0) return []

  const filtered = filterOcrReloadFolderIds(tree, folderIds, payload)
  return excludeStableViewingFromReload(filtered, selectedNode, payload, tree)
}

async function reloadListingFolders(
  nodeIds: Array<string>,
  loadChildrenMutation: ReturnType<typeof useLoadNodeChildrenMutation>,
): Promise<{ reloadedNodeIds: Array<string>; hadLoadError: boolean }> {
  const reloadedNodeIds: Array<string> = []
  let hadLoadError = false

  await mapWithConcurrency(nodeIds, RELOAD_CONCURRENCY, async (nodeId) => {
    try {
      const result = await loadChildrenMutation.mutateAsync({
        nodeId,
        refresh: true,
      })
      if (result.changed) {
        reloadedNodeIds.push(nodeId)
      }
    } catch {
      hadLoadError = true
    }
  })

  return { reloadedNodeIds, hadLoadError }
}

export type OcrTerminalCompletePayloadT = {
  dossierId: string
  folderId: string
  status: DataDossierStatus
}

export function useDataManagementOcrSocket({
  role,
  projectCode,
  tree,
  selectedNode,
  dossierId,
  extraWatchFolderIds = [],
  extraWatchDossierIds = [],
  enabled,
  onOcrTerminalComplete,
}: {
  role: DataManagementRole
  projectCode?: string
  tree: DataTreeNodeT | null | undefined
  selectedNode: DataTreeNodeT | null
  dossierId?: string | null
  extraWatchFolderIds?: Array<string>
  extraWatchDossierIds?: Array<string>
  enabled: boolean
  onOcrTerminalComplete?: (payload: OcrTerminalCompletePayloadT) => void
}) {
  const { t } = useTranslation('data-management')
  const queryClient = useQueryClient()
  const treeQueryKey = useMemo(
    () => dataManagementTreeQueryKey(role, projectCode),
    [projectCode, role],
  )
  const loadChildrenMutation = useLoadNodeChildrenMutation(role, projectCode)
  const selectedNodeRef = useRef(selectedNode)
  selectedNodeRef.current = selectedNode

  const onOcrTerminalCompleteRef = useRef(onOcrTerminalComplete)
  onOcrTerminalCompleteRef.current = onOcrTerminalComplete

  const reloadBatchRef = useRef<ReloadBatchRef>({
    timer: null,
    nodeIds: new Set(),
    showSuccessToast: false,
    showFailureToast: false,
    optimisticApplied: false,
  })

  const reloadInFlightRef = useRef(false)

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
  }, [dossierId, extraWatchDossierIds, extraWatchFolderIds, selectedNode, tree])

  const { pendingFolderIds, pendingFolderIdsKey } = useMemo(() => {
    const folderIds = tree ? collectOcrPendingListingFolderIds(tree) : []
    return {
      pendingFolderIds: folderIds,
      pendingFolderIdsKey: [...folderIds].sort().join('|'),
    }
  }, [tree])

  const pendingFolderIdsRef = useRef(pendingFolderIds)
  pendingFolderIdsRef.current = pendingFolderIds

  const executeFolderReload = useCallback(
    async (
      rawNodeIds: Array<string>,
      options: ReloadFoldersOptionsT,
    ): Promise<void> => {
      if (reloadInFlightRef.current) {
        logOcrSocketDebug(`${options.logLabel} skipped: reload in flight`)
        return
      }

      const currentTree = queryClient.getQueryData<DataTreeNodeT>(treeQueryKey)
      const nodeIds = resolveReloadFolderIds(
        currentTree ?? null,
        filterRecentlyReloaded(rawNodeIds),
        selectedNodeRef.current,
        options.payload,
      )

      const {
        showSuccessToast = false,
        showFailureToast = false,
        optimisticApplied = false,
      } = options

      if (nodeIds.length === 0) {
        if (optimisticApplied) {
          if (showSuccessToast) toast.success(t('socket.ocrCompleted'))
          if (showFailureToast) toast.error(t('socket.ocrFailed'))
        } else {
          logOcrSocketDebug(`${options.logLabel} skipped: no folders`, {
            rawNodeIds,
            payload: options.payload,
          })
        }
        return
      }

      reloadInFlightRef.current = true
      const startedAt = performance.now()
      logOcrSocketDebug(`${options.logLabel} start`, { nodeIds })

      try {
        const { reloadedNodeIds, hadLoadError } = await reloadListingFolders(
          nodeIds,
          loadChildrenMutation,
        )

        if (reloadedNodeIds.length > 0) {
          markRecentlyReloaded(reloadedNodeIds)
        }

        logOcrSocketDebug(`${options.logLabel} done`, {
          ms: Math.round(performance.now() - startedAt),
          nodeIds,
          reloadedNodeIds,
          hadLoadError,
        })

        if (hadLoadError) {
          toast.error(t('errors.loadFailed'))
          return
        }

        const uiUpdated = reloadedNodeIds.length > 0 || optimisticApplied
        if (showSuccessToast && uiUpdated) {
          toast.success(t('socket.ocrCompleted'))
        }
        if (showFailureToast && uiUpdated) {
          toast.error(t('socket.ocrFailed'))
        }
      } finally {
        reloadInFlightRef.current = false
      }
    },
    [loadChildrenMutation, queryClient, t, treeQueryKey],
  )

  const executeFolderReloadRef = useRef(executeFolderReload)
  executeFolderReloadRef.current = executeFolderReload

  const flushReloadBatch = useCallback(async () => {
    const batch = reloadBatchRef.current
    batch.timer = null

    const rawNodeIds = [...batch.nodeIds]
    const showSuccessToast = batch.showSuccessToast
    const showFailureToast = batch.showFailureToast
    const optimisticApplied = batch.optimisticApplied
    const batchPayload = batch.payload

    batch.nodeIds.clear()
    batch.showSuccessToast = false
    batch.showFailureToast = false
    batch.optimisticApplied = false
    batch.payload = undefined

    await executeFolderReloadRef.current(rawNodeIds, {
      payload: batchPayload,
      showSuccessToast,
      showFailureToast,
      optimisticApplied,
      logLabel: 'reload batch',
    })
  }, [])

  const flushReloadBatchRef = useRef(flushReloadBatch)
  flushReloadBatchRef.current = flushReloadBatch

  const scheduleReloadBatch = useCallback(
    (
      nodeIds: Array<string>,
      status: DataDossierStatus,
      payload?: OcrCompletedPayloadT,
      optimisticApplied = false,
    ) => {
      const batch = reloadBatchRef.current
      for (const nodeId of nodeIds) {
        batch.nodeIds.add(nodeId)
      }

      if (payload) {
        batch.payload = payload
      }

      if (optimisticApplied) {
        batch.optimisticApplied = true
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

      const treeBeforeUpdate =
        queryClient.getQueryData<DataTreeNodeT>(treeQueryKey)
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

      let optimisticApplied = false
      queryClient.setQueryData<DataTreeNodeT>(treeQueryKey, (currentTree) => {
        if (!currentTree) return currentTree
        const { tree: nextTree, updated } = updateDossierStatusInTree(
          currentTree,
          {
            dossierId: payload.dossierId,
            folderId: payload.folderId,
            status,
          },
        )
        optimisticApplied = updated
        return nextTree
      })

      if (!OCR_TERMINAL_RELOAD_STATUSES.has(status)) {
        logOcrSocketDebug('skipped listing reload for non-terminal status', {
          dossierId: payload.dossierId,
          status,
        })
        return
      }

      const currentTree = queryClient.getQueryData<DataTreeNodeT>(treeQueryKey)
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

      scheduleReloadBatch(
        [...reloadNodeIds],
        status,
        payload,
        optimisticApplied,
      )

      onOcrTerminalCompleteRef.current?.({
        dossierId: payload.dossierId,
        folderId: payload.folderId,
        status,
      })
    },
    [queryClient, scheduleReloadBatch, treeQueryKey],
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
  const [isSocketConnected, setIsSocketConnected] = useState(false)

  useEffect(() => {
    if (!enabled) return

    const socket = acquireDossierSocket()
    socketInstanceRef.current = socket

    const applyRooms = () => {
      setIsSocketConnected(true)
      syncSocketRooms(socket, joinedRoomsRef.current, socketRoomsRef.current)
    }

    const onDisconnect = () => {
      setIsSocketConnected(false)
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

      setIsSocketConnected(false)
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
    if (!enabled || isSocketConnected || pendingFolderIdsKey.length === 0) {
      return
    }

    let pollAttempt = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const scheduleNextPoll = () => {
      if (cancelled) return

      const delay = Math.min(
        OCR_POLL_BASE_INTERVAL_MS * 2 ** pollAttempt,
        OCR_POLL_MAX_INTERVAL_MS,
      )

      timeoutId = setTimeout(() => {
        pollAttempt += 1

        if (reloadInFlightRef.current) {
          logOcrSocketDebug('poll skipped: reload in flight')
          scheduleNextPoll()
          return
        }

        const nodeIds = pendingFolderIdsRef.current
        if (nodeIds.length === 0) {
          scheduleNextPoll()
          return
        }

        void executeFolderReloadRef
          .current(nodeIds, { logLabel: 'poll reload' })
          .finally(() => {
            scheduleNextPoll()
          })
      }, delay)
    }

    scheduleNextPoll()

    return () => {
      cancelled = true
      if (timeoutId != null) {
        clearTimeout(timeoutId)
      }
    }
  }, [enabled, isSocketConnected, pendingFolderIdsKey])
}
