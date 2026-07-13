import { queryOptions } from '@tanstack/react-query'

import {
  getArchiveWarehouseDossierDetail,
  getArchiveWarehouseDossiers,
  getArchiveWarehouseFondSummary,
} from '@/features/archive-warehouse/api/archiveWarehouseClient'
import type {
  GetArchiveWarehouseDossiersParamsT,
  GetArchiveWarehouseFondSummaryParamsT,
} from '@/features/archive-warehouse/types'

export const archiveWarehouseDossiersQueryKeyPrefix = [
  'archive-warehouse',
  'dossiers',
] as const

export const archiveWarehouseFondSummaryQueryKeyPrefix = [
  'archive-warehouse',
  'fond-summary',
] as const

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
