import type { QueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { toast } from 'sonner'

import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import {
  reloadTreePathToNode,
  resolveRecordDossierId,
  updateDossierStatusInTree,
} from '@/features/data-management/lib/treeUtils'
import { dataManagementTreeQueryKey } from '@/features/data-management/queries'
import type { DataTreeNodeT } from '@/features/data-management/types'
import type { OcrCompletedPayloadT } from '@/lib/socket/types'

const DEDUPE_MS = 300
const recentByDossier = new Map<string, number>()

function shouldSkipDedupe(dossierId: string): boolean {
  const now = Date.now()
  const last = recentByDossier.get(dossierId)
  if (last != null && now - last < DEDUPE_MS) return true
  recentByDossier.set(dossierId, now)
  return false
}

function isViewingDossier(
  payload: OcrCompletedPayloadT,
  nodeId: string | undefined,
  selectedNode: DataTreeNodeT | null,
): boolean {
  if (nodeId === payload.dossierId) return true
  if (nodeId === payload.folderId) return true
  return resolveRecordDossierId(selectedNode) === payload.dossierId
}

export async function applyOcrCompleted(options: {
  queryClient: QueryClient
  role: DataManagementRole
  payload: OcrCompletedPayloadT
  nodeId: string | undefined
  selectedNode: DataTreeNodeT | null
  focusDocumentId: string | undefined
  refreshDossier: (dossierId: string) => Promise<DataTreeNodeT>
  refreshTree: (dossierId?: string) => Promise<DataTreeNodeT>
  loadChildren: (nodeId: string) => Promise<DataTreeNodeT>
  claimNext?: () => Promise<DataTreeNodeT>
  t: TFunction<'data-management'>
}): Promise<void> {
  const {
    queryClient,
    role,
    payload,
    nodeId,
    selectedNode,
    focusDocumentId,
    refreshDossier,
    refreshTree,
    loadChildren,
    claimNext,
    t,
  } = options

  if (shouldSkipDedupe(payload.dossierId)) return

  if (payload.fromStatus && payload.status === payload.fromStatus) return

  queryClient.setQueryData<DataTreeNodeT>(
    dataManagementTreeQueryKey(role),
    (currentTree) => {
      if (!currentTree) return currentTree
      return updateDossierStatusInTree(currentTree, {
        dossierId: payload.dossierId,
        folderId: payload.folderId,
        status: payload.status,
      })
    },
  )

  try {
    const tree = await refreshDossier(payload.dossierId)
    queryClient.setQueryData(dataManagementTreeQueryKey(role), tree)
  } catch {
    // Status already updated in-memory; dossier may not be expanded yet.
  }

  if (payload.status === 'READY_FOR_ENTRY') {
    toast.success(t('socket.ocrCompleted'))
  } else if (payload.status === 'OCR_FAILED') {
    toast.error(t('socket.ocrFailed'))
  }

  if (!isViewingDossier(payload, nodeId, selectedNode)) return

  try {
    if (role === 'editor' && claimNext) {
      await claimNext()
      return
    }

    const targetNodeId = focusDocumentId ?? nodeId
    const freshTree = await refreshTree(
      role === 'editor' ? payload.dossierId : undefined,
    )
    queryClient.setQueryData(dataManagementTreeQueryKey(role), freshTree)
    if (targetNodeId) {
      const reloadedTree = await reloadTreePathToNode(
        freshTree,
        targetNodeId,
        loadChildren,
      )
      queryClient.setQueryData(dataManagementTreeQueryKey(role), reloadedTree)
    }
  } catch (error) {
    if (role === 'editor' && isNoAssignedDossierError(error)) {
      toast.info(t('errors.noAssignedDossier'))
    }
  }
}
