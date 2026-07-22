import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  createArchiveFieldConfig,
  deleteArchiveFieldConfig,
  getArchiveFieldConfigs,
  reorderArchiveFieldConfigs,
  updateArchiveFieldConfig,
} from '@/features/archive-config/api/archiveConfigClient'
import type {
  CreateArchiveFieldConfigPayloadT,
  UpdateArchiveFieldConfigPayloadT,
} from '@/features/archive-config/types'

export const archiveFieldConfigsQueryKeyPrefix = ['admin', 'archive-field-configs'] as const

export const archiveSubmissionFieldConfigsQueryKeyPrefix = [
  'archive-submissions',
  'field-configs',
] as const

async function invalidateArchiveFieldConfigQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: archiveFieldConfigsQueryKeyPrefix }),
    queryClient.invalidateQueries({
      queryKey: archiveSubmissionFieldConfigsQueryKeyPrefix,
    }),
  ])
}

export function archiveFieldConfigsQueryOptions() {
  return queryOptions({
    queryKey: archiveFieldConfigsQueryKeyPrefix,
    queryFn: getArchiveFieldConfigs,
  })
}

export function useCreateArchiveFieldConfigMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateArchiveFieldConfigPayloadT) =>
      createArchiveFieldConfig(payload),
    onSuccess: async () => {
      await invalidateArchiveFieldConfigQueries(queryClient)
    },
  })
}

export function useUpdateArchiveFieldConfigMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateArchiveFieldConfigPayloadT
    }) => updateArchiveFieldConfig(id, payload),
    onSuccess: async () => {
      await invalidateArchiveFieldConfigQueries(queryClient)
    },
  })
}

export function useDeleteArchiveFieldConfigMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteArchiveFieldConfig(id),
    onSuccess: async () => {
      await invalidateArchiveFieldConfigQueries(queryClient)
    },
  })
}

export function useReorderArchiveFieldConfigsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: Array<string>) => reorderArchiveFieldConfigs(ids),
    onSuccess: async () => {
      await invalidateArchiveFieldConfigQueries(queryClient)
    },
  })
}
