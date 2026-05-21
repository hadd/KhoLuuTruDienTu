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
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'

export const dataManagementTreeQueryKey = (role: DataManagementRole) => [
  role,
  'data-management',
  'tree',
] as const

export const dataManagementTreeQueryOptions = (role: DataManagementRole) =>
  queryOptions({
    queryKey: dataManagementTreeQueryKey(role),
    queryFn: () => getDataTree(role), // Call getDataTree with role eventually
    staleTime: 30_000,
  })

export function useUploadDataFolderMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (files: Array<File>) => uploadDataFolder(files),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
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

export function useDeleteDataNodeMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDataNode(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
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

export function useAssignDataRecordMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assignDataRecord,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}
