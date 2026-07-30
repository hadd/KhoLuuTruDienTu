import { queryOptions } from '@tanstack/react-query'

import {
  getDisposalCandidates,
  getDisposalCatalog,
  getDisposalCatalogs,
} from '@/features/archive-disposal/api/archiveDisposalClient'
import type { GetDisposalCandidatesParamsT } from '@/features/archive-disposal/types'

export const disposalCandidatesQueryKeyPrefix = [
  'archive-disposal',
  'candidates',
] as const

export const disposalCatalogsQueryKeyPrefix = [
  'archive-disposal',
  'catalogs',
] as const

export function disposalCandidatesQueryOptions(
  params: GetDisposalCandidatesParamsT | null,
) {
  return queryOptions({
    staleTime: 0,
    queryKey: [...disposalCandidatesQueryKeyPrefix, params ?? {}],
    queryFn: () => getDisposalCandidates(params!),
    enabled: Boolean(params),
  })
}

export function disposalCatalogsQueryOptions(params?: {
  page?: number
  limit?: number
}) {
  return queryOptions({
    staleTime: 0,
    queryKey: [...disposalCatalogsQueryKeyPrefix, params ?? {}],
    queryFn: () => getDisposalCatalogs(params),
  })
}

export function disposalCatalogDetailQueryOptions(catalogId: string | null) {
  return queryOptions({
    staleTime: 0,
    queryKey: ['archive-disposal', 'catalog', catalogId],
    queryFn: () => getDisposalCatalog(catalogId!),
    enabled: Boolean(catalogId),
  })
}
