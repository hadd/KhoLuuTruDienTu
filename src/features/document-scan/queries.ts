import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { uploadScanBatch } from '@/features/document-scan/api/scanClient'
import {
  collectDescendantNodeIds,
  countUploadBatchStats,
} from '@/features/document-scan/lib/scanTreeUtils'
import {
  addScanPages,
  createScanNode,
  deleteScanNode,
  deleteScanPage,
  reorderScanPages,
  scanStore,
  updateScanNode,
  updateScanPage,
  uploadScanBatchRemoveNodes,
} from '@/features/document-scan/store'
import type { ScanPageRotationT } from '@/features/document-scan/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const scanWorkspaceQueryKey = ['document-scan', 'workspace'] as const

export const scanWorkspaceQueryOptions = () =>
  queryOptions({
    queryKey: scanWorkspaceQueryKey,
    queryFn: () => scanStore.getState(),
    staleTime: Infinity,
  })

function invalidateWorkspace(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.setQueryData(scanWorkspaceQueryKey, scanStore.getState())
}

export function useCreateScanNodeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      parentId,
      name,
    }: {
      parentId: string | null
      name: string
    }) => createScanNode(parentId, name),
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      toast.success(i18n.t('form.success.create', { ns: 'document-scan' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUpdateScanNodeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      updateScanNode(id, name),
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      toast.success(i18n.t('form.success.update', { ns: 'document-scan' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useDeleteScanNodeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      deleteScanNode(id)
    },
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      toast.success(i18n.t('delete.success', { ns: 'document-scan' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useAddScanPagesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      documentId,
      files,
    }: {
      documentId: string
      files: Array<File>
    }) => addScanPages(documentId, files),
    onSuccess: () => invalidateWorkspace(queryClient),
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUpdateScanPageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      pageId,
      patch,
    }: {
      pageId: string
      patch: Partial<{
        name: string
        rotation: ScanPageRotationT
        scale: number
      }>
    }) => updateScanPage(pageId, patch),
    onSuccess: () => invalidateWorkspace(queryClient),
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useReorderScanPagesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      documentId,
      orderedPageIds,
    }: {
      documentId: string
      orderedPageIds: Array<string>
    }) => reorderScanPages(documentId, orderedPageIds),
    onSuccess: () => invalidateWorkspace(queryClient),
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useDeleteScanPageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (pageId: string) => {
      deleteScanPage(pageId)
    },
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      toast.success(i18n.t('page.delete.success', { ns: 'document-scan' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUploadScanBatchMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (nodeIds: Array<string>) => {
      const workspace = scanStore.getState()
      const stats = countUploadBatchStats(workspace, nodeIds)

      await uploadScanBatch({
        nodeIds,
        documentCount: stats.documentCount,
        pageCount: stats.pageCount,
      })

      uploadScanBatchRemoveNodes(nodeIds)
      return nodeIds
    },
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      toast.success(i18n.t('upload.success', { ns: 'document-scan' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function collectCheckedSubtreeIds(
  workspace: ReturnType<typeof scanStore.getState>,
  checkedIds: Array<string>,
): Array<string> {
  const unique = new Set<string>()
  for (const checkedId of checkedIds) {
    for (const descendantId of collectDescendantNodeIds(workspace, checkedId)) {
      unique.add(descendantId)
    }
  }
  return [...unique]
}
