import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  approveArchiveSubmission,
  getActiveArchiveFieldConfigs,
  getArchiveDossiers,
  getArchiveSubmission,
  getArchiveSubmissionsByDossier,
  getPendingArchiveSubmissions,
  rejectArchiveSubmission,
  submitArchiveSubmission,
} from '@/features/archive-submission/api/archiveSubmissionClient'
import type {
  GetArchiveDossiersParamsT,
  RejectArchivePayloadT,
  SubmitArchivePayloadT,
} from '@/features/archive-submission/types'

export const archiveFieldConfigsActiveQueryKeyPrefix = [
  'archive-submissions',
  'field-configs',
] as const

export const pendingArchiveSubmissionsQueryKeyPrefix = [
  'archive-submissions',
  'pending',
] as const

export const archiveDossiersQueryKeyPrefix = ['archive-submissions', 'dossiers'] as const

export function archiveDossiersQueryOptions(params?: GetArchiveDossiersParamsT) {
  return queryOptions({
    queryKey: [...archiveDossiersQueryKeyPrefix, params ?? {}],
    queryFn: () => getArchiveDossiers(params),
  })
}

export function activeArchiveFieldConfigsQueryOptions() {
  return queryOptions({
    queryKey: archiveFieldConfigsActiveQueryKeyPrefix,
    queryFn: getActiveArchiveFieldConfigs,
  })
}

export function pendingArchiveSubmissionsQueryOptions(params?: {
  page?: number
  limit?: number
}) {
  return queryOptions({
    queryKey: [...pendingArchiveSubmissionsQueryKeyPrefix, params ?? {}],
    queryFn: () => getPendingArchiveSubmissions(params),
  })
}

export function archiveSubmissionQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['archive-submissions', id],
    queryFn: () => getArchiveSubmission(id),
    enabled: Boolean(id),
  })
}

export function archiveSubmissionsByDossierQueryOptions(dossierId: string) {
  return queryOptions({
    queryKey: ['archive-submissions', 'dossier', dossierId],
    queryFn: () => getArchiveSubmissionsByDossier(dossierId),
    enabled: Boolean(dossierId),
  })
}

export function useSubmitArchiveMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      dossierId,
      payload,
    }: {
      dossierId: string
      payload: SubmitArchivePayloadT
    }) => submitArchiveSubmission(dossierId, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: pendingArchiveSubmissionsQueryKeyPrefix,
        }),
        queryClient.invalidateQueries({
          queryKey: archiveDossiersQueryKeyPrefix,
        }),
        queryClient.invalidateQueries({
          queryKey: ['archive-submissions', 'dossier', variables.dossierId],
        }),
        queryClient.invalidateQueries({ queryKey: ['data-management'] }),
      ])
    },
  })
}

export function useApproveArchiveMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => approveArchiveSubmission(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: pendingArchiveSubmissionsQueryKeyPrefix,
      })
      await queryClient.invalidateQueries({ queryKey: ['data-management'] })
    },
  })
}

export function useRejectArchiveMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: RejectArchivePayloadT
    }) => rejectArchiveSubmission(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: pendingArchiveSubmissionsQueryKeyPrefix,
      })
      await queryClient.invalidateQueries({ queryKey: ['data-management'] })
    },
  })
}
