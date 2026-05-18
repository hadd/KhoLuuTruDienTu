import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  getDataTree,
  uploadDataFolder,
} from '@/features/data-management/api/dataManagementClient'

export const dataManagementTreeQueryKey = ['admin', 'data-management', 'tree'] as const

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
