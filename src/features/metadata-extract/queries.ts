import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  getMetadataExtractSettings,
  updateMetadataExtractSettings,
  type MetadataExtractMode,
} from '@/features/metadata-extract/api/metadataExtractClient'
import { translateError } from '@/lib/utils/translate-error'

import {
  createMetadataHiddenField,
  deleteMetadataHiddenField,
  getActiveMetadataHiddenFields,
  getMetadataHiddenFields,
  updateMetadataHiddenField,
  type CreateMetadataHiddenFieldInputT,
  type UpdateMetadataHiddenFieldInputT,
} from '@/features/metadata-extract/api/metadataHiddenFieldClient'

export const metadataExtractSettingsQueryKey = [
  'metadata-extract',
  'settings',
] as const

export const metadataHiddenFieldsQueryKey = [
  'metadata-extract',
  'hidden-fields',
] as const

export const activeMetadataHiddenFieldsQueryKey = [
  'metadata-extract',
  'active-hidden-fields',
] as const

export const metadataExtractSettingsQueryOptions = () =>
  queryOptions({
    queryKey: metadataExtractSettingsQueryKey,
    queryFn: getMetadataExtractSettings,
    staleTime: 30_000,
  })

export const metadataHiddenFieldsQueryOptions = () =>
  queryOptions({
    queryKey: metadataHiddenFieldsQueryKey,
    queryFn: getMetadataHiddenFields,
    staleTime: 10_000,
  })

export const activeMetadataHiddenFieldsQueryOptions = () =>
  queryOptions({
    queryKey: activeMetadataHiddenFieldsQueryKey,
    queryFn: getActiveMetadataHiddenFields,
    staleTime: 10_000,
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

export function useCreateMetadataHiddenFieldMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateMetadataHiddenFieldInputT) =>
      createMetadataHiddenField(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: metadataHiddenFieldsQueryKey })
      void queryClient.invalidateQueries({ queryKey: activeMetadataHiddenFieldsQueryKey })
      toast.success('Đã thêm trường ẩn thành công')
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUpdateMetadataHiddenFieldMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: UpdateMetadataHiddenFieldInputT
    }) => updateMetadataHiddenField(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: metadataHiddenFieldsQueryKey })
      void queryClient.invalidateQueries({ queryKey: activeMetadataHiddenFieldsQueryKey })
      toast.success('Đã cập nhật trường thành công')
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useDeleteMetadataHiddenFieldMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteMetadataHiddenField(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: metadataHiddenFieldsQueryKey })
      void queryClient.invalidateQueries({ queryKey: activeMetadataHiddenFieldsQueryKey })
      toast.success('Đã xóa trường ẩn thành công')
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

