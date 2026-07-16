import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createWatermarkPlacement,
  deleteWatermarkPlacement,
  getWatermarkPlacement,
  listWatermarkImages,
  listWatermarkPlacements,
  setWatermarkPlacementActive,
  updateWatermarkPlacement,
  uploadWatermarkImage,
  WatermarkConfigApiError,
} from '@/features/watermark-config/api/watermarkConfigClient'
import type {
  CreateWatermarkPlacementPayloadT,
  UpdateWatermarkPlacementPayloadT,
} from '@/features/watermark-config/types'
import i18n from '@/lib/i18n/config'

export const watermarkPlacementsQueryKey = [
  'admin',
  'watermark-placements',
] as const

export const watermarkImagesQueryKey = ['admin', 'watermark-images'] as const

export const watermarkPlacementDetailQueryKey = (placementId: string) =>
  [...watermarkPlacementsQueryKey, placementId] as const

export const watermarkPlacementsQueryOptions = () =>
  queryOptions({
    queryKey: watermarkPlacementsQueryKey,
    queryFn: listWatermarkPlacements,
    staleTime: 60_000,
  })

export const watermarkImagesQueryOptions = () =>
  queryOptions({
    queryKey: watermarkImagesQueryKey,
    queryFn: listWatermarkImages,
    staleTime: 60_000,
  })

export const watermarkPlacementDetailQueryOptions = (placementId: string) =>
  queryOptions({
    queryKey: watermarkPlacementDetailQueryKey(placementId),
    queryFn: () => getWatermarkPlacement(placementId),
    staleTime: 30_000,
  })

function getErrorMessage(error: Error): string {
  if (error instanceof WatermarkConfigApiError) {
    if (error.code === 'notFound') {
      return i18n.t('errors.notFound', { ns: 'watermark-config' })
    }
    if (error.code === 'validation' && error.details) {
      return error.details
    }
  }

  return i18n.t('errors.saveFailed', { ns: 'watermark-config' })
}

export function useCreateWatermarkPlacement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateWatermarkPlacementPayloadT) =>
      createWatermarkPlacement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: watermarkPlacementsQueryKey })
      toast.success(i18n.t('form.success.create', { ns: 'watermark-config' }))
    },
    onError: (error: Error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useUpdateWatermarkPlacement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      placementId,
      payload,
    }: {
      placementId: string
      payload: UpdateWatermarkPlacementPayloadT
    }) => updateWatermarkPlacement(placementId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: watermarkPlacementsQueryKey })
      queryClient.invalidateQueries({
        queryKey: watermarkPlacementDetailQueryKey(variables.placementId),
      })
      toast.success(i18n.t('form.success.update', { ns: 'watermark-config' }))
    },
    onError: (error: Error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useSetWatermarkPlacementActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      placementId,
      isActive,
    }: {
      placementId: string
      isActive: boolean
    }) => setWatermarkPlacementActive(placementId, isActive),
    onSuccess: (placement) => {
      queryClient.invalidateQueries({ queryKey: watermarkPlacementsQueryKey })
      queryClient.invalidateQueries({
        queryKey: watermarkPlacementDetailQueryKey(placement.id),
      })
      toast.success(
        i18n.t(
          placement.isActive
            ? 'active.enabledSuccess'
            : 'active.disabledSuccess',
          { ns: 'watermark-config' },
        ),
      )
    },
    onError: (error: Error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useDeleteWatermarkPlacement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteWatermarkPlacement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: watermarkPlacementsQueryKey })
      toast.success(i18n.t('delete.success', { ns: 'watermark-config' }))
    },
    onError: () => {
      toast.error(i18n.t('delete.error', { ns: 'watermark-config' }))
    },
  })
}

export function useUploadWatermarkImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadWatermarkImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: watermarkImagesQueryKey })
      toast.success(i18n.t('form.upload.success', { ns: 'watermark-config' }))
    },
    onError: () => {
      toast.error(i18n.t('form.upload.error', { ns: 'watermark-config' }))
    },
  })
}
