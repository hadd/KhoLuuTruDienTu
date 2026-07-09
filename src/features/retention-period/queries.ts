import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createRetentionPeriodRecord,
  deleteRetentionPeriodRecord,
  getRetentionPeriods,
  updateRetentionPeriodRecord,
} from '@/features/retention-period/api/retentionPeriodClient'
import type {
  CreateRetentionPeriodPayloadT,
  GetRetentionPeriodsParamsT,
  UpdateRetentionPeriodPayloadT,
} from '@/features/retention-period/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const retentionPeriodsQueryKeyPrefix = [
  'admin',
  'retention-periods',
] as const

export const retentionPeriodsQueryKey = (
  params?: GetRetentionPeriodsParamsT,
) => [...retentionPeriodsQueryKeyPrefix, params ?? {}] as const

export const retentionPeriodsQueryOptions = (
  params?: GetRetentionPeriodsParamsT,
) =>
  queryOptions({
    queryKey: retentionPeriodsQueryKey(params),
    queryFn: () => getRetentionPeriods(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

export function useCreateRetentionPeriod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateRetentionPeriodPayloadT) =>
      createRetentionPeriodRecord(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: retentionPeriodsQueryKeyPrefix,
      })
      toast.success(
        i18n.t('form.success.create', { ns: 'retention-period' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUpdateRetentionPeriod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateRetentionPeriodPayloadT
    }) => updateRetentionPeriodRecord(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: retentionPeriodsQueryKeyPrefix,
      })
      toast.success(
        i18n.t('form.success.update', { ns: 'retention-period' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useDeleteRetentionPeriod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteRetentionPeriodRecord(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: retentionPeriodsQueryKeyPrefix,
      })
      toast.success(i18n.t('delete.success', { ns: 'retention-period' }))
    },
    onError: (error) => {
      toast.error(
        translateError(error) ||
          i18n.t('delete.error', { ns: 'retention-period' }),
      )
    },
  })
}
