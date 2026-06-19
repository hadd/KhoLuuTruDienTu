import { useRef } from 'react'
import type { Query, QueryClient } from '@tanstack/react-query'
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import type {
  DataDeleteRequestT,
  LoadNodeChildrenResultT,
} from '@/features/data-management/api/dataManagementClient'
import {
  addDataDocument,
  addDataFolder,
  assignDataRecord,
  assignDossierEditor,
  deleteDataNode,
  fetchDossierMetadataHistory,
  restoreDossierMetadataHistory,
  getDataTree,
  loadNodeChildren,
  refreshDossierContent,
  renameDataNode,
  updateDossier,
  uploadDataFolder,
} from '@/features/data-management/api/dataManagementClient'
import { getProjects } from '@/features/data-management/api/projectClient'
import {
  persistDossierMetadataByRole,
  rejectCheckerDossier,
} from '@/features/data-management/api/dataEntryClient'
import type {
  UploadFolderOptions,
  UploadFolderResult,
  UploadProgress,
} from '@/features/data-management/api/dossierClient'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import { updateDossierMetadataInTree } from '@/features/data-management/lib/treeUtils'
import type { DataDossierMetadataT, DataTreeNodeT } from '@/features/data-management/types'

export const dataManagementTreeQueryKey = (
  role: DataManagementRole,
  projectCode?: string,
) =>
  role === 'admin' && projectCode
    ? ([role, 'data-management', 'tree', projectCode] as const)
    : ([role, 'data-management', 'tree'] as const)

export const dataManagementProjectsQueryKey = ['data-management', 'projects'] as const

export const dataManagementProjectsQueryOptions = () =>
  queryOptions({
    queryKey: dataManagementProjectsQueryKey,
    queryFn: () => getProjects(),
    staleTime: 60_000,
  })

export const dossierMetadataHistoryQueryKey = (dossierId: string) =>
  ['data-management', 'dossier-metadata-history', dossierId] as const

export const dossierMetadataHistoryQueryOptions = (dossierId: string) =>
  queryOptions({
    queryKey: dossierMetadataHistoryQueryKey(dossierId),
    queryFn: () => fetchDossierMetadataHistory(dossierId),
    staleTime: 30_000,
    enabled: Boolean(dossierId.trim()),
  })

function setQueryErrorWithoutRefetch(
  qc: QueryClient,
  queryKey: ReturnType<typeof dataManagementTreeQueryKey>,
  error: unknown,
): void {
  qc.setQueryData(queryKey, undefined)
  const query = qc.getQueryCache().find({ queryKey })
  query?.setState({
    status: 'error',
    error: error instanceof Error ? error : new Error(String(error)),
    fetchStatus: 'idle',
  })
}

export const dataManagementTreeQueryOptions = (
  role: DataManagementRole,
  projectCode?: string,
) =>
  queryOptions({
    queryKey: dataManagementTreeQueryKey(role, projectCode),
    queryFn: () => getDataTree(role, { projectCode }),
    staleTime: 30_000,
    enabled: role !== 'admin' || Boolean(projectCode?.trim()),
    retry: (failureCount, error) =>
      !isNoAssignedDossierError(error) && failureCount < 1,
    ...(role === 'editor'
      ? {
          refetchOnMount: (
            query: Query<
              DataTreeNodeT,
              Error,
              DataTreeNodeT,
              ReturnType<typeof dataManagementTreeQueryKey>
            >,
          ) => !isNoAssignedDossierError(query.state.error),
        }
      : {}),
  })

export function useUploadDataFolderMutation(
  role: DataManagementRole,
  projectCode?: string,
  onProgress?: (p: UploadProgress) => void,
) {
  const qc = useQueryClient()
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress

  return useMutation<
    UploadFolderResult,
    Error,
    { files: Array<File> } & UploadFolderOptions
  >({
    mutationFn: ({ files, uploadPoint, allowOverwrite }) =>
      uploadDataFolder(files, (p) => onProgressRef.current?.(p), {
        uploadPoint,
        allowOverwrite,
        projectCode,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: dataManagementTreeQueryKey(role, projectCode),
      })
    },
  })
}

export function useRenameDataNodeMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameDataNode(id, name),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}

export function useDeleteDataNodeMutation(
  role: DataManagementRole,
  projectCode?: string,
) {
  const qc = useQueryClient()
  return useMutation<void, Error, DataDeleteRequestT>({
    mutationFn: deleteDataNode,
    onSuccess: async () => {
      const tree = await getDataTree(role, { refresh: true, projectCode })
      qc.setQueryData(dataManagementTreeQueryKey(role, projectCode), tree)
    },
  })
}

export function useAddDataDocumentMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (parentId: string) => addDataDocument(parentId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}

export function useAddDataFolderMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (parentId: string) => addDataFolder(parentId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}

export function useUpdateDossierMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateDossier,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}

export function useAssignDataRecordMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assignDataRecord,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}

export function useAssignDossierEditorMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assignDossierEditor,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}

export type LoadNodeChildrenMutationInput =
  | string
  | { nodeId: string; refresh?: boolean }

export function useLoadNodeChildrenMutation(
  role: DataManagementRole,
  projectCode?: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LoadNodeChildrenMutationInput) => {
      const nodeId = typeof input === 'string' ? input : input.nodeId
      const refresh = typeof input === 'string' ? false : input.refresh
      return loadNodeChildren(nodeId, role, { refresh, projectCode })
    },
    onSuccess: (result: LoadNodeChildrenResultT) => {
      if (result.changed) {
        qc.setQueryData(
          dataManagementTreeQueryKey(role, projectCode),
          result.tree,
        )
      }
    },
  })
}

export function useClaimNextMakerAssignmentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => getDataTree('editor', { refresh: true, claimNext: true }),
    onSuccess: (tree) => {
      qc.setQueryData(dataManagementTreeQueryKey('editor'), tree)
    },
    onError: (error) => {
      if (!isNoAssignedDossierError(error)) return
      setQueryErrorWithoutRefetch(
        qc,
        dataManagementTreeQueryKey('editor'),
        error,
      )
    },
  })
}

export function useRefreshEditorDossierMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dossierId: string) =>
      getDataTree('editor', { refresh: true, dossierId }),
    onSuccess: (tree) => {
      qc.setQueryData(dataManagementTreeQueryKey('editor'), tree)
    },
  })
}

export function useRefreshDataManagementTreeMutation(
  role: DataManagementRole,
  projectCode?: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dossierId?: string) => {
      if (role === 'editor') {
        return getDataTree('editor', { refresh: true, dossierId })
      }
      return getDataTree(role, { refresh: true, projectCode })
    },
    onSuccess: (tree) => {
      qc.setQueryData(dataManagementTreeQueryKey(role, projectCode), tree)
    },
  })
}

export function useRefreshDossierContentMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dossierId: string) => refreshDossierContent(dossierId),
    onSuccess: (tree) => {
      qc.setQueryData(dataManagementTreeQueryKey(role), tree)
    },
  })
}

export function useRejectCheckerDossierMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      dossierId,
      notes,
      rejectFields,
    }: {
      dossierId: string
      notes: string
      rejectFields: Array<string>
    }) =>
      rejectCheckerDossier(dossierId, {
        notes,
        reject_fields: rejectFields,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}

export function useRestoreDossierMetadataHistoryMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      dossierId,
      historyId,
    }: {
      dossierId: string
      historyId: string
    }) => restoreDossierMetadataHistory(dossierId, historyId),
    onSuccess: (_result, { dossierId }) => {
      void qc.invalidateQueries({
        queryKey: dossierMetadataHistoryQueryKey(dossierId),
      })
    },
  })
}

export function useSaveDossierMetadataMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      dossierId,
      metadata,
    }: {
      dossierId: string
      metadata: DataDossierMetadataT
    }) => persistDossierMetadataByRole(role, dossierId, metadata),
    onSuccess: (_result, { dossierId, metadata }) => {
      qc.setQueryData<DataTreeNodeT>(
        dataManagementTreeQueryKey(role),
        (currentTree) => {
          if (!currentTree) return currentTree
          return updateDossierMetadataInTree(currentTree, dossierId, metadata)
        },
      )
      void qc.invalidateQueries({
        queryKey: dossierMetadataHistoryQueryKey(dossierId),
      })
    },
  })
}
