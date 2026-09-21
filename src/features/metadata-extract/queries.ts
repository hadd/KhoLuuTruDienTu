import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  getMetadataExtractSettings,
  updateMetadataExtractSettings,
  type MetadataExtractMode,
} from '@/features/metadata-extract/api/metadataExtractClient'
import {
  getPageQuota,
  uploadPageQuotaLicense,
} from '@/features/metadata-extract/api/pageQuotaClient'
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

export const metadataHiddenFieldsQueryOptions = (mode?: string) =>
  queryOptions({
    queryKey: mode
      ? ([...metadataHiddenFieldsQueryKey, mode] as const)
      : metadataHiddenFieldsQueryKey,
    queryFn: () =>
      getMetadataHiddenFields(
        mode ? { metadataExtractModeCode: mode } : undefined,
      ),
    staleTime: 10_000,
  })

export const activeMetadataHiddenFieldsQueryOptions = (mode?: string) =>
  queryOptions({
    queryKey: mode
      ? ([...activeMetadataHiddenFieldsQueryKey, mode] as const)
      : activeMetadataHiddenFieldsQueryKey,
    queryFn: () =>
      getActiveMetadataHiddenFields(
        mode ? { metadataExtractModeCode: mode } : undefined,
      ),
    staleTime: 10_000,
  })

export const pageQuotaQueryKey = ['page-quota'] as const

export const pageQuotaQueryOptions = () =>
  queryOptions({
    queryKey: pageQuotaQueryKey,
    queryFn: getPageQuota,
    staleTime: 15_000,
  })

export function useUploadPageQuotaLicenseMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => uploadPageQuotaLicense(file),
    onSuccess: (data) => {
      queryClient.setQueryData(pageQuotaQueryKey, data)
      void queryClient.invalidateQueries({ queryKey: pageQuotaQueryKey })
      toast.success('Đã nạp file license hạn mức trang')
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

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

