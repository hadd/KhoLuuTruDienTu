import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import type {
  FetchPendingManualDossiersParamsT,
  FetchTrackedManualDossiersParamsT,
} from '@/features/ocr-control/api/ocrControlClient'
import {
  fetchPendingManualDossiers,
  fetchTrackedManualDossiers,
  triggerManualOcr,
} from '@/features/ocr-control/api/ocrControlClient'

export const pendingManualDossiersQueryKeyPrefix = [
  'ocr-control',
  'pending-manual',
] as const

export const trackedManualDossiersQueryKeyPrefix = [
  'ocr-control',
  'tracked',
] as const

export function pendingManualDossiersQueryOptions(
  params?: FetchPendingManualDossiersParamsT,
) {
  return queryOptions({
    queryKey: [...pendingManualDossiersQueryKeyPrefix, params ?? {}],
    queryFn: () => fetchPendingManualDossiers(params),
  })
}

export function trackedManualDossiersQueryOptions(
  params?: FetchTrackedManualDossiersParamsT,
) {
  return queryOptions({
    queryKey: [...trackedManualDossiersQueryKeyPrefix, params ?? {}],
    queryFn: () => fetchTrackedManualDossiers(params),
    refetchInterval: (query) => {
      const summary = query.state.data?.summary
      const items = query.state.data?.items ?? []
      const hasProcessing =
        (summary?.processingCount ?? 0) > 0 ||
        items.some((item) => item.uiStatus === 'processing')
      return hasProcessing ? 8_000 : false
    },
  })
}

export function useTriggerManualOcrMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dossierIds: Array<string>) => triggerManualOcr(dossierIds),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: pendingManualDossiersQueryKeyPrefix,
        }),
        queryClient.invalidateQueries({
          queryKey: trackedManualDossiersQueryKeyPrefix,
        }),
      ])
    },
  })
}
