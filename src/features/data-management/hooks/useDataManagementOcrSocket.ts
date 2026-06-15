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
  resolveRecordDossierId,
  updateDossierStatusInTree,
} from '@/features/data-management/lib/treeUtils'
import {
  dataManagementTreeQueryKey,
  useRefreshDossierContentMutation,
} from '@/features/data-management/queries'
import type {
  DataDossierStatus,
  DataTreeNodeT,
  OcrCompletedEventT,
} from '@/features/data-management/types'

const OCR_COMPLETED_DEDUPE_MS = 300
const DOSSIER_RELOAD_DEBOUNCE_MS = 500
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
  const refreshDossierMutation = useRefreshDossierContentMutation(role)
  const selectedNodeRef = useRef(selectedNode)
  const pendingDossierReloads = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  )
  selectedNodeRef.current = selectedNode

  const scheduleReloadDossier = useCallback(
    (targetDossierId: string) => {
      const existing = pendingDossierReloads.current.get(targetDossierId)
      if (existing) clearTimeout(existing)

      pendingDossierReloads.current.set(
        targetDossierId,
        setTimeout(() => {
          pendingDossierReloads.current.delete(targetDossierId)
          void refreshDossierMutation.mutateAsync(targetDossierId).catch(() => {
            toast.error(t('errors.loadFailed'))
          })
        }, DOSSIER_RELOAD_DEBOUNCE_MS),
      )
    },
    [refreshDossierMutation, t],
  )

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
    (payload: OcrCompletedEventT) => {
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

      if (payload.fromStatus && payload.status === payload.fromStatus) {
        logOcrSocketDebug('ignored: status unchanged', {
          dossierId: payload.dossierId,
          status: payload.status,
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

      logOcrSocketDebug('ocr reload dossier', payload.dossierId)
      scheduleReloadDossier(payload.dossierId)

      if (status === 'READY_FOR_ENTRY') {
        toast.success(t('socket.ocrCompleted'))
        return
      }

      if (status === 'OCR_FAILED') {
        toast.error(t('socket.ocrFailed'))
      }
    },
    [queryClient, role, scheduleReloadDossier, t],
  )

  useEffect(() => {
    const pendingReloads = pendingDossierReloads.current
    return () => {
      for (const timeoutId of pendingReloads.values()) {
        clearTimeout(timeoutId)
      }
      pendingReloads.clear()
    }
  }, [])

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
