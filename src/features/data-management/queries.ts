import { useRef } from 'react'
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import {
  addDataDocument,
  addDataFolder,
  assignDataRecord,
  assignDossierEditor,
  deleteDataNode,
  getDataTree,
  loadNodeChildren,
  renameDataNode,
  updateDossier,
  uploadDataFolder,
} from '@/features/data-management/api/dataManagementClient'
import type { UploadFolderResult, UploadProgress } from '@/features/data-management/api/dossierClient'
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

export function useUploadDataFolderMutation(
  role: DataManagementRole,
  onProgress?: (p: UploadProgress) => void,
) {
  const qc = useQueryClient()
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress

  return useMutation<UploadFolderResult, Error, Array<File>>({
    mutationFn: (files: Array<File>) =>
      uploadDataFolder(files, (p) => onProgressRef.current?.(p)),
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

export function useLoadNodeChildrenMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nodeId: string) => loadNodeChildren(nodeId, role),
    onSuccess: async (newTree) => {
      // Opt to set query data directly to avoid a refetch if desired,
      // but invalidateQueries works fine since getDataTree caches.
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}
