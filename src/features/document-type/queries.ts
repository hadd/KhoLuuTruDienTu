import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createDocumentTypeRecord,
  deleteDocumentTypeRecord,
  getDocumentTypes,
  updateDocumentTypeRecord,
} from '@/features/document-type/api/documentTypeClient'
import type {
  CreateDocumentTypePayloadT,
  GetDocumentTypesParamsT,
  UpdateDocumentTypePayloadT,
} from '@/features/document-type/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const documentTypesQueryKeyPrefix = ['admin', 'document-types'] as const

export const documentTypesQueryKey = (params?: GetDocumentTypesParamsT) =>
  [...documentTypesQueryKeyPrefix, params ?? {}] as const

export const documentTypesQueryOptions = (params?: GetDocumentTypesParamsT) =>
  queryOptions({
    queryKey: documentTypesQueryKey(params),
    queryFn: () => getDocumentTypes(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

export function useCreateDocumentType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateDocumentTypePayloadT) =>
      createDocumentTypeRecord(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: documentTypesQueryKeyPrefix,
      })
      toast.success(i18n.t('form.success.create', { ns: 'document-type' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUpdateDocumentType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateDocumentTypePayloadT
    }) => updateDocumentTypeRecord(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: documentTypesQueryKeyPrefix,
      })
      toast.success(i18n.t('form.success.update', { ns: 'document-type' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useDeleteDocumentType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteDocumentTypeRecord(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: documentTypesQueryKeyPrefix,
      })
      toast.success(i18n.t('delete.success', { ns: 'document-type' }))
    },
    onError: (error) => {
      toast.error(
        translateError(error) || i18n.t('delete.error', { ns: 'document-type' }),
      )
    },
  })
}
