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

export function archiveWarehouseFondsQueryOptions() {
  return queryOptions({
    queryKey: archiveWarehouseFondsQueryKey,
    queryFn: getArchiveWarehouseFonds,
    staleTime: 60_000,
  })
}

export function archiveWarehouseDossierTypesQueryOptions() {
  return queryOptions({
    queryKey: archiveWarehouseDossierTypesQueryKey,
    queryFn: getArchiveWarehouseDossierTypes,
    staleTime: 60_000,
  })
}

export function archiveWarehouseDocumentTypesQueryOptions() {
  return queryOptions({
    queryKey: archiveWarehouseDocumentTypesQueryKey,
    queryFn: getArchiveWarehouseDocumentTypes,
    staleTime: 60_000,
  })
}

export function archiveWarehouseFondSummaryQueryOptions(
  params: GetArchiveWarehouseFondSummaryParamsT | null,
) {
  return queryOptions({
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
    queryKey: [...archiveWarehouseUnassignedDossiersQueryKeyPrefix, params ?? {}],
    queryFn: () => getArchiveWarehouseUnassignedDossiers(params),
  })
}

export function archiveWarehouseDossiersQueryOptions(
  params: GetArchiveWarehouseDossiersParamsT | null,
) {
  return queryOptions({
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
    queryKey: [...archiveWarehouseDossierTypeSummaryQueryKeyPrefix, params ?? {}],
    queryFn: () => getArchiveWarehouseDossierTypeSummary(params!),
    enabled: Boolean(params?.dossierTypeId),
  })
}

export function archiveWarehouseDossiersByTypeQueryOptions(
  params: GetArchiveWarehouseDossiersByDossierTypeParamsT | null,
) {
  return queryOptions({
    queryKey: [...archiveWarehouseDossiersByTypeQueryKeyPrefix, params ?? {}],
    queryFn: () => getArchiveWarehouseDossiersByDossierType(params!),
    enabled: Boolean(params?.dossierTypeId),
  })
}

export function archiveWarehouseDocumentTypeSummaryQueryOptions(
  params: GetArchiveWarehouseDocumentTypeSummaryParamsT | null,
) {
  return queryOptions({
    queryKey: [...archiveWarehouseDocumentTypeSummaryQueryKeyPrefix, params ?? {}],
    queryFn: () => getArchiveWarehouseDocumentTypeSummary(params!),
    enabled: Boolean(params?.documentTypeId),
  })
}

export function archiveWarehouseDocumentsByTypeQueryOptions(
  params: GetArchiveWarehouseDocumentsByDocumentTypeParamsT | null,
) {
  return queryOptions({
    queryKey: [...archiveWarehouseDocumentsByTypeQueryKeyPrefix, params ?? {}],
    queryFn: () => getArchiveWarehouseDocumentsByDocumentType(params!),
    enabled: Boolean(params?.documentTypeId),
  })
}

export function archiveWarehouseDossierDetailQueryOptions(dossierId: string | null) {
  return queryOptions({
    queryKey: ['archive-warehouse', 'dossier-detail', dossierId],
    queryFn: () => getArchiveWarehouseDossierDetail(dossierId!),
    enabled: Boolean(dossierId),
  })
}

function hasSearchParams(params: GetArchiveWarehouseSearchParamsT): boolean {
  if (params.mode === 'content' || params.q?.trim()) {
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
    params.q?.trim(),
  )
}

export function archiveWarehouseSearchQueryOptions(
  params: GetArchiveWarehouseSearchParamsT | null,
) {
  return queryOptions({
    queryKey: [...archiveWarehouseSearchQueryKeyPrefix, params ?? {}],
    queryFn: () => searchArchiveWarehouseContent(params!),
    enabled: params != null && hasSearchParams(params),
  })
}
