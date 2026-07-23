import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import type { FetchPendingManualDossiersParamsT } from '@/features/ocr-control/api/ocrControlClient'
import {
  fetchPendingManualDossiers,
  triggerManualOcr,
} from '@/features/ocr-control/api/ocrControlClient'

export const pendingManualDossiersQueryKeyPrefix = [
  'ocr-control',
  'pending-manual',
] as const

export function pendingManualDossiersQueryOptions(
  params?: FetchPendingManualDossiersParamsT,
) {
  return queryOptions({
    queryKey: [...pendingManualDossiersQueryKeyPrefix, params ?? {}],
    queryFn: () => fetchPendingManualDossiers(params),
  })
}

export function useTriggerManualOcrMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dossierIds: Array<string>) => triggerManualOcr(dossierIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: pendingManualDossiersQueryKeyPrefix,
      })
    },
  })
}
