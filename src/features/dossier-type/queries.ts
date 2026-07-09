import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createDossierTypeRecord,
  deleteDossierTypeRecord,
  getDossierTypes,
  updateDossierTypeRecord,
} from '@/features/dossier-type/api/dossierTypeClient'
import type {
  CreateDossierTypePayloadT,
  GetDossierTypesParamsT,
  UpdateDossierTypePayloadT,
} from '@/features/dossier-type/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const dossierTypesQueryKeyPrefix = ['admin', 'dossier-types'] as const

export const dossierTypesQueryKey = (params?: GetDossierTypesParamsT) =>
  [...dossierTypesQueryKeyPrefix, params ?? {}] as const

export const dossierTypesQueryOptions = (params?: GetDossierTypesParamsT) =>
  queryOptions({
    queryKey: dossierTypesQueryKey(params),
    queryFn: async () => {
      const response = await getDossierTypes(params)
      return response.items
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

export function useCreateDossierType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateDossierTypePayloadT) =>
      createDossierTypeRecord(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: dossierTypesQueryKeyPrefix,
      })
      toast.success(i18n.t('form.success.create', { ns: 'dossier-type' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUpdateDossierType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateDossierTypePayloadT
    }) => updateDossierTypeRecord(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: dossierTypesQueryKeyPrefix,
      })
      toast.success(i18n.t('form.success.update', { ns: 'dossier-type' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useDeleteDossierType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteDossierTypeRecord(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: dossierTypesQueryKeyPrefix,
      })
      toast.success(i18n.t('delete.success', { ns: 'dossier-type' }))
    },
    onError: (error) => {
      toast.error(
        translateError(error) || i18n.t('delete.error', { ns: 'dossier-type' }),
      )
    },
  })
}
