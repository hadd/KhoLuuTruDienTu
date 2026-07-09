import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createInventoryRecord,
  deleteInventoryRecord,
  getInventories,
  updateInventoryRecord,
} from '@/features/inventory/api/inventoryClient'
import type {
  CreateInventoryPayloadT,
  GetInventoriesParamsT,
  UpdateInventoryPayloadT,
} from '@/features/inventory/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const inventoriesQueryKeyPrefix = ['admin', 'inventories'] as const

export const inventoriesQueryKey = (params?: GetInventoriesParamsT) =>
  [...inventoriesQueryKeyPrefix, params ?? {}] as const

export const inventoriesQueryOptions = (params?: GetInventoriesParamsT) =>
  queryOptions({
    queryKey: inventoriesQueryKey(params),
    queryFn: () => getInventories(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

export function useCreateInventory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateInventoryPayloadT) =>
      createInventoryRecord(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: inventoriesQueryKeyPrefix,
      })
      toast.success(i18n.t('form.success.create', { ns: 'inventory' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUpdateInventory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateInventoryPayloadT
    }) => updateInventoryRecord(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: inventoriesQueryKeyPrefix,
      })
      toast.success(i18n.t('form.success.update', { ns: 'inventory' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useDeleteInventory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteInventoryRecord(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: inventoriesQueryKeyPrefix,
      })
      toast.success(i18n.t('delete.success', { ns: 'inventory' }))
    },
    onError: (error) => {
      toast.error(
        translateError(error) || i18n.t('delete.error', { ns: 'inventory' }),
      )
    },
  })
}
