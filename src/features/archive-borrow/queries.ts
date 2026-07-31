import { mutationOptions, queryOptions } from '@tanstack/react-query'

import {
  activateArchiveBorrowRequest,
  approveArchiveBorrowRequest,
  createArchiveBorrowRequest,
  getArchiveBorrowDossierMetadata,
  getArchiveBorrowRequest,
  getArchiveBorrowViewModel,
  getMyArchiveBorrowRequests,
  getPendingArchiveBorrowRequests,
  regenerateArchiveBorrowDip,
  rejectArchiveBorrowRequest,
  searchArchiveBorrowEligibleDossiers,
} from '@/features/archive-borrow/api/archiveBorrowClient'
import type {
  ApproveArchiveBorrowInputT,
  CreateArchiveBorrowInputT,
} from '@/features/archive-borrow/types'

export const archiveBorrowKeys = {
  all: ['archive-borrows'] as const,
  mine: () => [...archiveBorrowKeys.all, 'mine'] as const,
  pending: () => [...archiveBorrowKeys.all, 'pending'] as const,
  detail: (id: string) => [...archiveBorrowKeys.all, 'detail', id] as const,
  viewModel: (id: string) =>
    [...archiveBorrowKeys.all, 'view-model', id] as const,
  dossierMetadata: (id: string, dossierId: string) =>
    [...archiveBorrowKeys.all, 'dossier-metadata', id, dossierId] as const,
  searchDossiers: (q: string) =>
    [...archiveBorrowKeys.all, 'search-dossiers', q] as const,
}

export function myArchiveBorrowRequestsQueryOptions() {
  return queryOptions({
    queryKey: archiveBorrowKeys.mine(),
    queryFn: () => getMyArchiveBorrowRequests(),
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
