import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import {
  acquireDossierSocket,
  logOcrSocketDebug,
  releaseDossierSocket,
} from '@/features/data-management/lib/dossierSocket'
import {
  collectOcrWatchFolderIds,
  resolveOcrReloadFolderIds,
  resolveRecordDossierId,
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

const OCR_COMPLETED_DEDUPE_MS = 300
const recentOcrCompletedByDossier = new Map<string, number>()

function shouldSkipDuplicateOcrCompleted(dossierId: string): boolean {
  const now = Date.now()
  const last = recentOcrCompletedByDossier.get(dossierId)
  if (last != null && now - last < OCR_COMPLETED_DEDUPE_MS) return true
  recentOcrCompletedByDossier.set(dossierId, now)
  return false
}

const DOSSIER_STATUSES = new Set<DataDossierStatus>([
  'NEW',
  'OCR_PROCESSING',
  'OCR_FAILED',
  'READY_FOR_ENTRY',
  'ENTRY_PROCESSING',
  'WAITING_CHECKER_1',
  'CHECKER_1_PROCESSING',
  'CHECKER_1_REJECTED',
  'WAITING_CHECKER_2',
  'CHECKER_2_PROCESSING',
  'CHECKER_2_REJECTED',
  'WAITING_CHECKER_3',
  'CHECKER_3_PROCESSING',
  'CHECKER_3_REJECTED',
  'WAITING_CHECKER_4',
  'CHECKER_4_PROCESSING',
  'CHECKER_4_REJECTED',
  'WAITING_CHECKER_5',
  'CHECKER_5_PROCESSING',
  'CHECKER_5_REJECTED',
  'APPROVED',
])

function parseDossierStatus(value: unknown): DataDossierStatus | null {
  if (
    typeof value === 'string' &&
    DOSSIER_STATUSES.has(value as DataDossierStatus)
  ) {
    return value as DataDossierStatus
  }
  return null
}

function resolveFolderJoinId(node: DataTreeNodeT | null): string | null {
  if (!node) return null
  if (node.type === 'folder') {
    if (node.parentId === null) return null
    return node.id
  }
  if (node.type === 'record') {
    return node.folderId ?? null
  }
  return null
}

function resolveDossierJoinId(
  node: DataTreeNodeT | null,
  dossierId?: string | null,
): string | null {
  if (!node) return null
  if (node.type === 'record') {
    return resolveRecordDossierId(node)
  }
  if (node.entityType === 'DOCUMENT' && node.dossierId) {
    return node.dossierId
  }
  return dossierId ?? null
}

function resolveFolderJoinIds(
  tree: DataTreeNodeT | null,
  selectedNode: DataTreeNodeT | null,
  extraWatchFolderIds: Array<string>,
): Array<string> {
  const ids = new Set<string>()

  const currentFolderId = resolveFolderJoinId(selectedNode)
  if (currentFolderId) ids.add(currentFolderId)

  if (tree) {
    for (const folderId of collectOcrWatchFolderIds(tree)) {
      ids.add(folderId)
    }
  }

  for (const folderId of extraWatchFolderIds) {
    if (folderId.trim()) ids.add(folderId)
  }

  return [...ids]
}

function isViewingOcrTarget(
  node: DataTreeNodeT | null,
  payload: OcrCompletedEventT,
): boolean {
  if (!node) return false

  const recordDossierId = resolveRecordDossierId(node)
  if (recordDossierId && recordDossierId === payload.dossierId) return true
  if (node.id === payload.folderId || node.folderId === payload.folderId) {
    return true
  }
  return false
}

function resolveDossierJoinIds(
  selectedNode: DataTreeNodeT | null,
  dossierId: string | null | undefined,
  extraWatchDossierIds: Array<string>,
): Array<string> {
  const ids = new Set<string>()

  const currentDossierId = resolveDossierJoinId(selectedNode, dossierId)
  if (currentDossierId) ids.add(currentDossierId)

  for (const id of extraWatchDossierIds) {
    if (id.trim()) ids.add(id)
  }

  return [...ids]
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

  const folderJoinIds = useMemo(
    () => resolveFolderJoinIds(tree ?? null, selectedNode, extraWatchFolderIds),
    [extraWatchFolderIds, selectedNode, tree],
  )
  const dossierJoinIds = useMemo(
    () => resolveDossierJoinIds(selectedNode, dossierId, extraWatchDossierIds),
    [dossierId, extraWatchDossierIds, selectedNode],
  )
  const folderJoinIdsKey = folderJoinIds.join('|')
  const dossierJoinIdsKey = dossierJoinIds.join('|')

  const handleOcrCompleted = useCallback(
    async (payload: OcrCompletedEventT) => {
      logOcrSocketDebug('ocr:completed received', payload)

      if (shouldSkipDuplicateOcrCompleted(payload.dossierId)) {
        logOcrSocketDebug('ignored: duplicate event', payload.dossierId)
        return
      }

      const status = parseDossierStatus(payload.status)
      if (!status) {
        logOcrSocketDebug('ignored: unknown status', payload.status)
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
    socket.on('ocr:completed', handleOcrCompleted)

    return () => {
      socket.off('ocr:completed', handleOcrCompleted)
      releaseDossierSocket()
    }
  }, [enabled, handleOcrCompleted])

  useEffect(() => {
    if (!enabled) return

    const socket = acquireDossierSocket()
    const joinedFolderIds = folderJoinIdsKey
      ? folderJoinIdsKey.split('|').filter(Boolean)
      : []
    const joinedDossierIds = dossierJoinIdsKey
      ? dossierJoinIdsKey.split('|').filter(Boolean)
      : []

    function joinRooms() {
      for (const folderId of joinedFolderIds) {
        socket.emit('join:folder', folderId)
        logOcrSocketDebug('emit join:folder', folderId)
      }
      for (const dossierId of joinedDossierIds) {
        socket.emit('join:dossier', dossierId)
        logOcrSocketDebug('emit join:dossier', dossierId)
      }
      logOcrSocketDebug('rooms', {
        folderJoinIds: joinedFolderIds,
        dossierJoinIds: joinedDossierIds,
      })
    }

    socket.on('connect', joinRooms)
    if (socket.connected) {
      joinRooms()
    }

    return () => {
      socket.off('connect', joinRooms)
      for (const folderId of joinedFolderIds) {
        socket.emit('leave:folder', folderId)
        logOcrSocketDebug('emit leave:folder', folderId)
      }
      for (const dossierId of joinedDossierIds) {
        socket.emit('leave:dossier', dossierId)
        logOcrSocketDebug('emit leave:dossier', dossierId)
      }
      releaseDossierSocket()
    }
  }, [dossierJoinIdsKey, enabled, folderJoinIdsKey])
}
