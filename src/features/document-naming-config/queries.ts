import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  getDocumentNamingConfig,
  getDocumentNamingDossierOptions,
  getDocumentNamingFieldCatalog,
  previewDocumentNamingConfig,
  upsertDocumentNamingConfig,
} from '@/features/document-naming-config/api/documentNamingConfigClient'
import type {
  DocumentNamingPreviewPayloadT,
  DocumentNamingTargetTypeT,
  UpsertDocumentNamingConfigPayloadT,
} from '@/features/document-naming-config/types'

export const documentNamingFieldCatalogQueryKey = [
  'document-naming-config',
  'field-catalog',
] as const

export const documentNamingConfigQueryKeyPrefix = [
  'document-naming-config',
  'config',
] as const

export const documentNamingDossierOptionsQueryKeyPrefix = [
  'document-naming-config',
  'dossier-options',
] as const

export function documentNamingFieldCatalogQueryOptions() {
  return queryOptions({
    queryKey: documentNamingFieldCatalogQueryKey,
    queryFn: getDocumentNamingFieldCatalog,
    staleTime: 60_000,
  })
}

export function documentNamingConfigQueryOptions(params: {
  fondId: string
  targetType: DocumentNamingTargetTypeT
  dossierId?: string
} | null) {
  return queryOptions({
    queryKey: [...documentNamingConfigQueryKeyPrefix, params ?? {}],
    queryFn: () => getDocumentNamingConfig(params!),
    enabled: Boolean(params?.fondId),
    staleTime: 0,
  })
}

export function documentNamingDossierOptionsQueryOptions(params: {
  fondId: string
  search?: string
} | null) {
  return queryOptions({
    queryKey: [...documentNamingDossierOptionsQueryKeyPrefix, params ?? {}],
    queryFn: () => getDocumentNamingDossierOptions({ ...params!, limit: 50 }),
    enabled: Boolean(params?.fondId),
    staleTime: 30_000,
  })
}

export function useUpsertDocumentNamingConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpsertDocumentNamingConfigPayloadT) =>
      upsertDocumentNamingConfig(payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: documentNamingConfigQueryKeyPrefix,
      })
      void queryClient.invalidateQueries({
        queryKey: [
          ...documentNamingConfigQueryKeyPrefix,
          {
            fondId: variables.fondId,
            targetType: variables.targetType,
            dossierId: variables.dossierId ?? undefined,
          },
        ],
      })
    },
  })
}

export function usePreviewDocumentNamingConfig() {
  return useMutation({
    mutationFn: (payload: DocumentNamingPreviewPayloadT) =>
      previewDocumentNamingConfig(payload),
  })
}
