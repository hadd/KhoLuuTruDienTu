import { mutationOptions, queryOptions } from '@tanstack/react-query'

import {
  activateArchiveBorrowRequest,
  approveArchiveBorrowRequest,
  createArchiveBorrowAnnotation,
  createArchiveBorrowRequest,
  deleteArchiveBorrowAnnotation,
  getArchiveBorrowAnnotations,
  getArchiveBorrowDossierMetadata,
  getArchiveBorrowReadingProgress,
  getArchiveBorrowReadingSummary,
  getArchiveBorrowRequest,
  getArchiveBorrowViewModel,
  getMyArchiveBorrowRequests,
  getPendingArchiveBorrowRequests,
  regenerateArchiveBorrowDip,
  rejectArchiveBorrowRequest,
  searchArchiveBorrowEligibleDossiers,
  updateArchiveBorrowAnnotation,
  upsertArchiveBorrowReadingProgress,
} from '@/features/archive-borrow/api/archiveBorrowClient'
import type {
  ApproveArchiveBorrowInputT,
  ArchiveBorrowMineListParamsT,
  CreateArchiveBorrowAnnotationInputT,
  CreateArchiveBorrowInputT,
  UpdateArchiveBorrowAnnotationInputT,
} from '@/features/archive-borrow/types'

export const archiveBorrowKeys = {
  all: ['archive-borrows'] as const,
  mine: (params?: ArchiveBorrowMineListParamsT) =>
    [...archiveBorrowKeys.all, 'mine', params ?? {}] as const,
  readingSummary: () =>
    [...archiveBorrowKeys.all, 'reading-summary'] as const,
  pending: () => [...archiveBorrowKeys.all, 'pending'] as const,
  detail: (id: string) => [...archiveBorrowKeys.all, 'detail', id] as const,
  viewModel: (id: string) =>
    [...archiveBorrowKeys.all, 'view-model', id] as const,
  dossierMetadata: (id: string, dossierId: string) =>
    [...archiveBorrowKeys.all, 'dossier-metadata', id, dossierId] as const,
  searchDossiers: (q: string) =>
    [...archiveBorrowKeys.all, 'search-dossiers', q] as const,
  readingProgress: (id: string, fileId?: string) =>
    [...archiveBorrowKeys.all, 'reading-progress', id, fileId ?? 'all'] as const,
  annotations: (id: string, fileId?: string) =>
    [...archiveBorrowKeys.all, 'annotations', id, fileId ?? 'all'] as const,
}

export function myArchiveBorrowRequestsQueryOptions(
  params: ArchiveBorrowMineListParamsT = {},
) {
  return queryOptions({
    queryKey: archiveBorrowKeys.mine(params),
    queryFn: () => getMyArchiveBorrowRequests(params),
  })
}

export function archiveBorrowReadingSummaryQueryOptions() {
  return queryOptions({
    queryKey: archiveBorrowKeys.readingSummary(),
    queryFn: () => getArchiveBorrowReadingSummary(),
  })
}

export function pendingArchiveBorrowRequestsQueryOptions() {
  return queryOptions({
    queryKey: archiveBorrowKeys.pending(),
    queryFn: () => getPendingArchiveBorrowRequests(),
  })
}

export function archiveBorrowEligibleDossiersQueryOptions(q: string) {
  const trimmed = q.trim()
  return queryOptions({
    queryKey: archiveBorrowKeys.searchDossiers(trimmed),
    queryFn: () =>
      searchArchiveBorrowEligibleDossiers({ q: trimmed, limit: 20 }),
    enabled: trimmed.length >= 2,
    staleTime: 15_000,
  })
}

export function archiveBorrowRequestQueryOptions(id: string) {
  return queryOptions({
    queryKey: archiveBorrowKeys.detail(id),
    queryFn: () => getArchiveBorrowRequest(id),
    enabled: Boolean(id),
  })
}

export function archiveBorrowViewModelQueryOptions(id: string) {
  return queryOptions({
    queryKey: archiveBorrowKeys.viewModel(id),
    queryFn: () => getArchiveBorrowViewModel(id),
    enabled: Boolean(id),
  })
}

export function archiveBorrowDossierMetadataQueryOptions(
  id: string,
  dossierId: string | null,
) {
  return queryOptions({
    queryKey: archiveBorrowKeys.dossierMetadata(id, dossierId ?? ''),
    queryFn: () => getArchiveBorrowDossierMetadata(id, dossierId!),
    enabled: Boolean(id && dossierId),
  })
}

export function archiveBorrowReadingProgressQueryOptions(
  id: string,
  fileId?: string | null,
) {
  return queryOptions({
    queryKey: archiveBorrowKeys.readingProgress(id, fileId ?? undefined),
    queryFn: () =>
      getArchiveBorrowReadingProgress(id, fileId ?? undefined),
    enabled: Boolean(id),
  })
}

export function archiveBorrowAnnotationsQueryOptions(
  id: string,
  fileId?: string | null,
) {
  return queryOptions({
    queryKey: archiveBorrowKeys.annotations(id, fileId ?? undefined),
    queryFn: () =>
      getArchiveBorrowAnnotations(id, {
        fileId: fileId ?? undefined,
      }),
    enabled: Boolean(id),
  })
}

export function createArchiveBorrowMutationOptions() {
  return mutationOptions({
    mutationFn: (input: CreateArchiveBorrowInputT) =>
      createArchiveBorrowRequest(input),
  })
}

export function approveArchiveBorrowMutationOptions(id: string) {
  return mutationOptions({
    mutationFn: (input: ApproveArchiveBorrowInputT) =>
      approveArchiveBorrowRequest(id, input),
  })
}

export function rejectArchiveBorrowMutationOptions(id: string) {
  return mutationOptions({
    mutationFn: (reviewNotes: string) =>
      rejectArchiveBorrowRequest(id, reviewNotes),
  })
}

export function activateArchiveBorrowMutationOptions(id: string) {
  return mutationOptions({
    mutationFn: () => activateArchiveBorrowRequest(id),
  })
}

export function regenerateArchiveBorrowDipMutationOptions(id: string) {
  return mutationOptions({
    mutationFn: (input?: { placementId?: string }) =>
      regenerateArchiveBorrowDip(id, input),
  })
}

export function upsertArchiveBorrowReadingProgressMutationOptions(id: string) {
  return mutationOptions({
    mutationFn: (input: { fileId: string; page: number }) =>
      upsertArchiveBorrowReadingProgress(id, input),
  })
}

export function createArchiveBorrowAnnotationMutationOptions(id: string) {
  return mutationOptions({
    mutationFn: (input: CreateArchiveBorrowAnnotationInputT) =>
      createArchiveBorrowAnnotation(id, input),
  })
}

export function updateArchiveBorrowAnnotationMutationOptions(id: string) {
  return mutationOptions({
    mutationFn: (input: {
      annotationId: string
      data: UpdateArchiveBorrowAnnotationInputT
    }) => updateArchiveBorrowAnnotation(id, input.annotationId, input.data),
  })
}

export function deleteArchiveBorrowAnnotationMutationOptions(id: string) {
  return mutationOptions({
    mutationFn: (annotationId: string) =>
      deleteArchiveBorrowAnnotation(id, annotationId),
  })
}
