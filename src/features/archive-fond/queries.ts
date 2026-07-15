import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createArchiveFondRecord,
  deleteArchiveFondRecord,
  getActiveArchiveFonds,
  getArchiveFonds,
  updateArchiveFondRecord,
} from '@/features/archive-fond/api/archiveFondClient'
import type {
  CreateArchiveFondPayloadT,
  GetArchiveFondsParamsT,
  UpdateArchiveFondPayloadT,
} from '@/features/archive-fond/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const archiveFondsQueryKeyPrefix = ['admin', 'archive-fonds'] as const
export const activeArchiveFondsQueryKey = ['catalog', 'fonds', 'active'] as const

export const archiveFondsQueryKey = (params?: GetArchiveFondsParamsT) =>
  [...archiveFondsQueryKeyPrefix, params ?? {}] as const

export const archiveFondsQueryOptions = (params?: GetArchiveFondsParamsT) =>
  queryOptions({
    queryKey: archiveFondsQueryKey(params),
    queryFn: () => getArchiveFonds(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

export const activeArchiveFondsQueryOptions = () =>
  queryOptions({
    queryKey: activeArchiveFondsQueryKey,
    queryFn: getActiveArchiveFonds,
    staleTime: 60_000,
  })

export function useCreateArchiveFond() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateArchiveFondPayloadT) =>
      createArchiveFondRecord(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: archiveFondsQueryKeyPrefix,
      })
      void queryClient.invalidateQueries({
        queryKey: activeArchiveFondsQueryKey,
      })
      toast.success(
        i18n.t('form.success.create', { ns: 'archive-fond' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUpdateArchiveFond() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateArchiveFondPayloadT
    }) => updateArchiveFondRecord(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: archiveFondsQueryKeyPrefix,
      })
      void queryClient.invalidateQueries({
        queryKey: activeArchiveFondsQueryKey,
      })
      toast.success(
        i18n.t('form.success.update', { ns: 'archive-fond' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useDeleteArchiveFond() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteArchiveFondRecord(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: archiveFondsQueryKeyPrefix,
      })
      void queryClient.invalidateQueries({
        queryKey: activeArchiveFondsQueryKey,
      })
      toast.success(i18n.t('delete.success', { ns: 'archive-fond' }))
    },
    onError: (error) => {
      toast.error(
        translateError(error) || i18n.t('delete.error', { ns: 'archive-fond' }),
      )
    },
  })
}
