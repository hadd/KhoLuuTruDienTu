import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import {
  addDataDocument,
  addDataFolder,
  assignDataRecord,
  deleteDataNode,
  getDataTree,
  renameDataNode,
  uploadDataFolder,
} from '@/features/data-management/api/dataManagementClient'

export const dataManagementTreeQueryKey = [
  'admin',
  'data-management',
  'tree',
] as const

export const dataManagementTreeQueryOptions = () =>
  queryOptions({
    queryKey: dataManagementTreeQueryKey,
    queryFn: getDataTree,
    staleTime: 30_000,
  })

export function useUploadDataFolderMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (files: Array<File>) => uploadDataFolder(files),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey })
    },
  })
}

export function useRenameDataNodeMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameDataNode(id, name),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey })
    },
  })
}

export function useDeleteDataNodeMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDataNode(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey })
    },
  })
}

export function useAddDataDocumentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (parentId: string) => addDataDocument(parentId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey })
    },
  })
}

export function useAddDataFolderMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (parentId: string) => addDataFolder(parentId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey })
    },
  })
}

export function useAssignDataRecordMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assignDataRecord,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey })
    },
  })
}
