import { queryOptions } from '@tanstack/react-query'

import {
  getArchiveWarehouseDossierDetail,
  getArchiveWarehouseDossiers,
  getArchiveWarehouseFonds,
  getArchiveWarehouseFondSummary,
  searchArchiveWarehouseContent,
} from '@/features/archive-warehouse/api/archiveWarehouseClient'
import type {
  GetArchiveWarehouseDossiersParamsT,
  GetArchiveWarehouseFondSummaryParamsT,
  GetArchiveWarehouseSearchParamsT,
} from '@/features/archive-warehouse/types'

export const archiveWarehouseDossiersQueryKeyPrefix = [
  'archive-warehouse',
  'dossiers',
] as const

export const archiveWarehouseFondsQueryKey = [
  'archive-warehouse',
  'fonds',
] as const

export const archiveWarehouseFondSummaryQueryKeyPrefix = [
  'archive-warehouse',
  'fond-summary',
] as const

export const archiveWarehouseSearchQueryKeyPrefix = [
  'archive-warehouse',
  'search',
] as const

export function archiveWarehouseFondsQueryOptions() {
  return queryOptions({
    queryKey: archiveWarehouseFondsQueryKey,
    queryFn: getArchiveWarehouseFonds,
    staleTime: 60_000,
  })
}

export function archiveWarehouseFondSummaryQueryOptions(
  params: GetArchiveWarehouseFondSummaryParamsT | null,
) {
  return queryOptions({
    queryKey: [...archiveWarehouseFondSummaryQueryKeyPrefix, params ?? {}],
    queryFn: () => getArchiveWarehouseFondSummary(params!),
    enabled: Boolean(params?.fondId),
  })
}

export function archiveWarehouseDossiersQueryOptions(
  params: GetArchiveWarehouseDossiersParamsT | null,
) {
  return queryOptions({
    queryKey: [...archiveWarehouseDossiersQueryKeyPrefix, params ?? {}],
    queryFn: () => getArchiveWarehouseDossiers(params!),
    enabled: Boolean(params?.fondId),
  })
}

export function archiveWarehouseDossierDetailQueryOptions(dossierId: string | null) {
  return queryOptions({
    queryKey: ['archive-warehouse', 'dossier-detail', dossierId],
    queryFn: () => getArchiveWarehouseDossierDetail(dossierId!),
    enabled: Boolean(dossierId),
  })
}

export function archiveWarehouseSearchQueryOptions(
  params: GetArchiveWarehouseSearchParamsT | null,
) {
  return queryOptions({
    queryKey: [...archiveWarehouseSearchQueryKeyPrefix, params ?? {}],
    queryFn: () => searchArchiveWarehouseContent(params!),
    enabled: Boolean(params?.q?.trim()),
  })
}
