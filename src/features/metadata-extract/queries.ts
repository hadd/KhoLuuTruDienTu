import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  getMetadataExtractSettings,
  updateMetadataExtractSettings,
  type MetadataExtractMode,
} from '@/features/metadata-extract/api/metadataExtractClient'
import { translateError } from '@/lib/utils/translate-error'

export const metadataExtractSettingsQueryKey = [
  'metadata-extract',
  'settings',
] as const

export const metadataExtractSettingsQueryOptions = () =>
  queryOptions({
    queryKey: metadataExtractSettingsQueryKey,
    queryFn: getMetadataExtractSettings,
    staleTime: 30_000,
  })

export function useUpdateMetadataExtractSettingsMutation(options?: {
  successMessage?: string
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (mode: MetadataExtractMode) =>
      updateMetadataExtractSettings({ mode }),
    onSuccess: (data) => {
      queryClient.setQueryData(metadataExtractSettingsQueryKey, data)
      void queryClient.invalidateQueries({
        queryKey: metadataExtractSettingsQueryKey,
      })
      if (options?.successMessage) {
        toast.success(options.successMessage)
      }
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}
