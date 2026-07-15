import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createPhysicalWarehouseItem,
  deletePhysicalWarehouseItem,
  getPhysicalWarehouseItems,
  getPhysicalWarehouseLevels,
  getPhysicalWarehouseStats,
  getPhysicalWarehouseTree,
  reparentPhysicalWarehouseItem,
  replacePhysicalWarehouseLevels,
  updatePhysicalWarehouseItem,
} from '@/features/physical-warehouse/api/physicalWarehouseClient'
import type {
  CreateItemPayloadT,
  ReplaceLevelsPayloadT,
  UpdateItemPayloadT,
} from '@/features/physical-warehouse/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const physicalWarehouseQueryKeyPrefix = [
  'physical-warehouse',
] as const

export const physicalWarehouseLevelsQueryKey = [
  ...physicalWarehouseQueryKeyPrefix,
  'levels',
] as const

export const physicalWarehouseLevelsQueryOptions = () =>
  queryOptions({
    queryKey: physicalWarehouseLevelsQueryKey,
    queryFn: () => getPhysicalWarehouseLevels(),
    staleTime: 30_000,
  })

export const physicalWarehouseItemsQueryKey = (parentId?: string) =>
  [...physicalWarehouseQueryKeyPrefix, 'items', parentId ?? 'roots'] as const

export const physicalWarehouseItemsQueryOptions = (parentId?: string) =>
  queryOptions({
    queryKey: physicalWarehouseItemsQueryKey(parentId),
    queryFn: () => getPhysicalWarehouseItems(parentId ? { parentId } : undefined),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  })

export const physicalWarehouseTreeQueryKey = (rootId: string) =>
  [...physicalWarehouseQueryKeyPrefix, 'tree', rootId] as const

export const physicalWarehouseTreeQueryOptions = (rootId: string) =>
  queryOptions({
    queryKey: physicalWarehouseTreeQueryKey(rootId),
    queryFn: () => getPhysicalWarehouseTree(rootId),
    enabled: Boolean(rootId),
    staleTime: 15_000,
  })

export const physicalWarehouseStatsQueryKey = (rootId: string) =>
  [...physicalWarehouseQueryKeyPrefix, 'stats', rootId] as const

export const physicalWarehouseStatsQueryOptions = (rootId: string) =>
  queryOptions({
    queryKey: physicalWarehouseStatsQueryKey(rootId),
    queryFn: () => getPhysicalWarehouseStats(rootId),
    enabled: Boolean(rootId),
    staleTime: 15_000,
  })

function invalidateWarehouseQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({
    queryKey: physicalWarehouseQueryKeyPrefix,
  })
}

export function useReplacePhysicalWarehouseLevels() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ReplaceLevelsPayloadT) =>
      replacePhysicalWarehouseLevels(payload),
    onSuccess: () => {
      invalidateWarehouseQueries(queryClient)
      toast.success(
        i18n.t('config.success.save', { ns: 'physical-warehouse' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useCreatePhysicalWarehouseItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateItemPayloadT) =>
      createPhysicalWarehouseItem(payload),
    onSuccess: () => {
      invalidateWarehouseQueries(queryClient)
      toast.success(
        i18n.t('form.success.create', { ns: 'physical-warehouse' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUpdatePhysicalWarehouseItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateItemPayloadT
    }) => updatePhysicalWarehouseItem(id, payload),
    onSuccess: () => {
      invalidateWarehouseQueries(queryClient)
      toast.success(
        i18n.t('form.success.update', { ns: 'physical-warehouse' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useReparentPhysicalWarehouseItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      itemId,
      newParentId,
    }: {
      itemId: string
      newParentId: string
    }) => reparentPhysicalWarehouseItem(itemId, newParentId),
    onSuccess: () => {
      invalidateWarehouseQueries(queryClient)
      toast.success(
        i18n.t('diagram.moveSuccess', { ns: 'physical-warehouse' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useDeletePhysicalWarehouseItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deletePhysicalWarehouseItem(id),
    onSuccess: () => {
      invalidateWarehouseQueries(queryClient)
      toast.success(
        i18n.t('delete.success', { ns: 'physical-warehouse' }),
      )
    },
    onError: (error) => {
      toast.error(
        translateError(error) ||
          i18n.t('delete.error', { ns: 'physical-warehouse' }),
      )
    },
  })
}
