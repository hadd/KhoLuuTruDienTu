import { queryOptions } from '@tanstack/react-query'

import {
  getArchiveWarehouseDossierDetail,
  getArchiveWarehouseDossiersByDossierType,
  getArchiveWarehouseDossierTypeSummary,
  getArchiveWarehouseDossierTypes,
  getArchiveWarehouseDocumentsByDocumentType,
  getArchiveWarehouseDocumentTypeSummary,
  getArchiveWarehouseDocumentTypes,
  getArchiveWarehouseDossiers,
  getArchiveWarehouseFonds,
  getArchiveWarehouseFondSummary,
  getArchiveWarehouseUnassignedDossiers,
  searchArchiveWarehouseContent,
} from '@/features/archive-warehouse/api/archiveWarehouseClient'
import { isUnassignedWarehouseFondId } from '@/features/archive-warehouse/lib/unassignedFond'
import { getRememberedDossierSecurityLevel } from '@/features/security-level/lib/securityAccessTokenStore'
import type {
  GetArchiveWarehouseDocumentsByDocumentTypeParamsT,
  GetArchiveWarehouseDossiersByDossierTypeParamsT,
  GetArchiveWarehouseDossierTypeSummaryParamsT,
  GetArchiveWarehouseDocumentTypeSummaryParamsT,
  GetArchiveWarehouseDossiersParamsT,
  GetArchiveWarehouseFondSummaryParamsT,
  GetArchiveWarehouseSearchParamsT,
  GetArchiveWarehouseUnassignedDossiersParamsT,
} from '@/features/archive-warehouse/types'

export const archiveWarehouseDossiersQueryKeyPrefix = [
  'archive-warehouse',
  'dossiers',
] as const

export const archiveWarehouseFondsQueryKey = [
  'archive-warehouse',
  'fonds',
] as const

export const archiveWarehouseDossierTypesQueryKey = [
  'archive-warehouse',
  'dossier-types',
] as const

export const archiveWarehouseDocumentTypesQueryKey = [
  'archive-warehouse',
  'document-types',
] as const

export const archiveWarehouseFondSummaryQueryKeyPrefix = [
  'archive-warehouse',
  'fond-summary',
] as const

export const archiveWarehouseSearchQueryKeyPrefix = [
  'archive-warehouse',
  'search',
] as const

export const archiveWarehouseDossierTypeSummaryQueryKeyPrefix = [
  'archive-warehouse',
  'dossier-type-summary',
] as const

export const archiveWarehouseDossiersByTypeQueryKeyPrefix = [
  'archive-warehouse',
  'dossiers',
  'by-dossier-type',
] as const

export const archiveWarehouseDocumentTypeSummaryQueryKeyPrefix = [
  'archive-warehouse',
  'document-type-summary',
] as const

export const archiveWarehouseDocumentsByTypeQueryKeyPrefix = [
  'archive-warehouse',
  'documents',
  'by-document-type',
] as const

const archiveWarehouseLiveQueryDefaults = {
  staleTime: 0,
  refetchOnMount: 'always' as const,
}

/** Catalog ít đổi — tránh DetailPage + FileViewer tải lại trùng trên mỗi mount. */
const archiveWarehouseCatalogQueryDefaults = {
  staleTime: 5 * 60 * 1000,
  refetchOnMount: true as const,
}

export function archiveWarehouseFondsQueryOptions() {
  return queryOptions({
    ...archiveWarehouseCatalogQueryDefaults,
    queryKey: archiveWarehouseFondsQueryKey,
    queryFn: getArchiveWarehouseFonds,
  })
}

export function archiveWarehouseDossierTypesQueryOptions() {
  return queryOptions({
    ...archiveWarehouseCatalogQueryDefaults,
    queryKey: archiveWarehouseDossierTypesQueryKey,
    queryFn: getArchiveWarehouseDossierTypes,
  })
}

export function archiveWarehouseDocumentTypesQueryOptions() {
  return queryOptions({
    ...archiveWarehouseCatalogQueryDefaults,
    queryKey: archiveWarehouseDocumentTypesQueryKey,
    queryFn: getArchiveWarehouseDocumentTypes,
  })
}

export function archiveWarehouseFondSummaryQueryOptions(
  params: GetArchiveWarehouseFondSummaryParamsT | null,
) {
  return queryOptions({
    ...archiveWarehouseLiveQueryDefaults,
    queryKey: [...archiveWarehouseFondSummaryQueryKeyPrefix, params ?? {}],
    queryFn: () => getArchiveWarehouseFondSummary(params!),
    enabled:
      Boolean(params?.fondId) && !isUnassignedWarehouseFondId(params?.fondId),
  })
}

export const archiveWarehouseUnassignedDossiersQueryKeyPrefix = [
  'archive-warehouse',
  'dossiers',
  'unassigned',
] as const

export function archiveWarehouseUnassignedDossiersQueryOptions(
  params?: GetArchiveWarehouseUnassignedDossiersParamsT,
) {
  return queryOptions({
    ...archiveWarehouseLiveQueryDefaults,
    queryKey: [
      ...archiveWarehouseUnassignedDossiersQueryKeyPrefix,
      params ?? {},
    ],
    queryFn: () => getArchiveWarehouseUnassignedDossiers(params),
  })
}

export function archiveWarehouseDossiersQueryOptions(
  params: GetArchiveWarehouseDossiersParamsT | null,
) {
  return queryOptions({
    ...archiveWarehouseLiveQueryDefaults,
    queryKey: [...archiveWarehouseDossiersQueryKeyPrefix, params ?? {}],
    queryFn: () => getArchiveWarehouseDossiers(params!),
    enabled:
      Boolean(params?.fondId) && !isUnassignedWarehouseFondId(params?.fondId),
  })
}

export function archiveWarehouseDossierTypeSummaryQueryOptions(
  params: GetArchiveWarehouseDossierTypeSummaryParamsT | null,
) {
  return queryOptions({
    ...archiveWarehouseLiveQueryDefaults,
    queryKey: [
      ...archiveWarehouseDossierTypeSummaryQueryKeyPrefix,
      params ?? {},
    ],
    queryFn: () => getArchiveWarehouseDossierTypeSummary(params!),
    enabled: Boolean(params?.dossierTypeId),
  })
}

export function archiveWarehouseDossiersByTypeQueryOptions(
  params: GetArchiveWarehouseDossiersByDossierTypeParamsT | null,
) {
  return queryOptions({
    ...archiveWarehouseLiveQueryDefaults,
    queryKey: [...archiveWarehouseDossiersByTypeQueryKeyPrefix, params ?? {}],
    queryFn: () => getArchiveWarehouseDossiersByDossierType(params!),
    enabled: Boolean(params?.dossierTypeId),
  })
}

export function archiveWarehouseDocumentTypeSummaryQueryOptions(
  params: GetArchiveWarehouseDocumentTypeSummaryParamsT | null,
) {
  return queryOptions({
    ...archiveWarehouseLiveQueryDefaults,
    queryKey: [
      ...archiveWarehouseDocumentTypeSummaryQueryKeyPrefix,
      params ?? {},
    ],
    queryFn: () => getArchiveWarehouseDocumentTypeSummary(params!),
    enabled: Boolean(params?.documentTypeId),
  })
}

export function archiveWarehouseDocumentsByTypeQueryOptions(
  params: GetArchiveWarehouseDocumentsByDocumentTypeParamsT | null,
) {
  return queryOptions({
    ...archiveWarehouseLiveQueryDefaults,
    queryKey: [...archiveWarehouseDocumentsByTypeQueryKeyPrefix, params ?? {}],
    queryFn: () => getArchiveWarehouseDocumentsByDocumentType(params!),
    enabled: Boolean(params?.documentTypeId),
  })
}

export function archiveWarehouseDossierDetailQueryOptions(
  dossierId: string | null,
  securityLevelId?: string | null,
) {
  return queryOptions({
    staleTime: 0,
    refetchOnMount: false,
    queryKey: ['archive-warehouse', 'dossier-detail', dossierId],
    queryFn: () =>
      getArchiveWarehouseDossierDetail(dossierId!, {
        securityLevelId:
          getRememberedDossierSecurityLevel('warehouse', dossierId!) ??
          securityLevelId,
      }),
    enabled: Boolean(dossierId),
    retry: false,
  })
}

function hasSearchParams(params: GetArchiveWarehouseSearchParamsT): boolean {
  if (params.mode === 'content' || params.mode === 'all' || params.q?.trim()) {
    return Boolean(params.q?.trim())
  }
  return Boolean(
    params.dossierName?.trim() ||
      params.documentName?.trim() ||
      params.dossierTypeId ||
      params.documentTypeId ||
      params.editorName?.trim() ||
      params.editCompletedAtFrom ||
      params.editCompletedAtTo ||
      params.archivedAtFrom ||
      params.archivedAtTo ||
      params.fondId ||
      params.searchFields ||
      params.q?.trim(),
  )
}

export function archiveWarehouseSearchQueryOptions(
  params: GetArchiveWarehouseSearchParamsT | null,
) {
  return queryOptions({
    ...archiveWarehouseLiveQueryDefaults,
    queryKey: [...archiveWarehouseSearchQueryKeyPrefix, params ?? {}],
    queryFn: () => searchArchiveWarehouseContent(params!),
    enabled: params != null && hasSearchParams(params),
  })
}
