import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  getArchiveGroupBinding,
  getArchiveUserAssignments,
  replaceArchiveUserAssignments,
  setGroupMemberArchiveSlot,
  upsertArchiveGroupBinding,
} from '@/features/archive-permission/api/archiveAssignmentClient'
import {
  createArchivePermissionConfig,
  deleteArchivePermissionConfig,
  getArchivePermissionConfigById,
  listArchivePermissionConfigs,
  listReadyArchivePermissionConfigOptions,
  updateArchivePermissionConfig,
} from '@/features/archive-permission/api/archivePermissionConfigClient'
import type {
  CreateArchivePermissionConfigPayloadT,
  ReplaceArchiveUserAssignmentsPayloadT,
  UpdateArchivePermissionConfigPayloadT,
  UpsertArchiveGroupBindingPayloadT,
} from '@/features/archive-permission/types'
import { getActiveArchiveFonds } from '@/features/archive-fond/api/archiveFondClient'
import { groupKeys } from '@/features/group/queries'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const archivePermissionConfigsQueryKey = [
  'admin',
  'archive-permission-configs',
] as const

export const readyArchivePermissionConfigOptionsQueryKey = [
  'admin',
  'archive-permission-configs',
  'options',
] as const

export const archivePermissionConfigQueryKey = (configId: string) =>
  ['admin', 'archive-permission-configs', configId] as const

export const archiveGroupBindingQueryKey = (groupId: string) =>
  ['admin', 'archive-assignments', 'groups', groupId] as const

export const archiveUserAssignmentsQueryKey = (userId: string) =>
  ['admin', 'archive-assignments', 'users', userId] as const

export const activeArchiveFondsQueryKey = ['fonds', 'active'] as const

export const archivePermissionConfigsQueryOptions = (
  status?: 'draft' | 'ready' | 'close',
) =>
  queryOptions({
    queryKey: status
      ? [...archivePermissionConfigsQueryKey, { status }]
      : archivePermissionConfigsQueryKey,
    queryFn: () => listArchivePermissionConfigs(status),
    staleTime: 30_000,
  })

export const readyArchivePermissionConfigOptionsQueryOptions = () =>
  queryOptions({
    queryKey: readyArchivePermissionConfigOptionsQueryKey,
    queryFn: listReadyArchivePermissionConfigOptions,
    staleTime: 60_000,
  })

export const archivePermissionConfigQueryOptions = (configId: string) =>
  queryOptions({
    queryKey: archivePermissionConfigQueryKey(configId),
    queryFn: () => getArchivePermissionConfigById(configId),
    enabled: Boolean(configId),
    staleTime: 30_000,
  })

export const archiveGroupBindingQueryOptions = (groupId: string) =>
  queryOptions({
    queryKey: archiveGroupBindingQueryKey(groupId),
    queryFn: () => getArchiveGroupBinding(groupId),
    enabled: Boolean(groupId),
    staleTime: 30_000,
  })

export const archiveUserAssignmentsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: archiveUserAssignmentsQueryKey(userId),
    queryFn: () => getArchiveUserAssignments(userId),
    enabled: Boolean(userId),
    staleTime: 30_000,
  })

export const activeArchiveFondsQueryOptions = () =>
  queryOptions({
    queryKey: activeArchiveFondsQueryKey,
    queryFn: getActiveArchiveFonds,
    staleTime: 60_000,
  })

export const useCreateArchivePermissionConfig = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateArchivePermissionConfigPayloadT) =>
      createArchivePermissionConfig(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: archivePermissionConfigsQueryKey,
      })
      toast.success(
        i18n.t('toast.createSuccess', { ns: 'archive-permission' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export const useUpdateArchivePermissionConfig = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      configId,
      payload,
    }: {
      configId: string
      payload: UpdateArchivePermissionConfigPayloadT
    }) => updateArchivePermissionConfig(configId, payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: archivePermissionConfigsQueryKey,
      })
      void queryClient.invalidateQueries({
        queryKey: archivePermissionConfigQueryKey(data.id),
      })
      void queryClient.invalidateQueries({
        queryKey: readyArchivePermissionConfigOptionsQueryKey,
      })
      toast.success(i18n.t('toast.saveSuccess', { ns: 'archive-permission' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export const useDeleteArchivePermissionConfig = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (configId: string) => deleteArchivePermissionConfig(configId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: archivePermissionConfigsQueryKey,
      })
      void queryClient.invalidateQueries({
        queryKey: readyArchivePermissionConfigOptionsQueryKey,
      })
      toast.success(
        i18n.t('toast.deleteSuccess', { ns: 'archive-permission' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export const useUpsertArchiveGroupBinding = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      groupId,
      payload,
    }: {
      groupId: string
      payload: UpsertArchiveGroupBindingPayloadT
    }) => upsertArchiveGroupBinding(groupId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: archiveGroupBindingQueryKey(variables.groupId),
      })
      toast.success(i18n.t('toast.saveSuccess', { ns: 'archive-permission' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export const useSetGroupMemberArchiveSlot = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      groupId,
      memberId,
      archivePermissionSlotCode,
    }: {
      groupId: string
      memberId: string
      archivePermissionSlotCode: string | null
    }) =>
      setGroupMemberArchiveSlot(
        groupId,
        memberId,
        archivePermissionSlotCode,
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: groupKeys.detail(variables.groupId),
      })
      toast.success(i18n.t('toast.saveSuccess', { ns: 'archive-permission' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export const useReplaceArchiveUserAssignments = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string
      payload: ReplaceArchiveUserAssignmentsPayloadT
    }) => replaceArchiveUserAssignments(userId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: archiveUserAssignmentsQueryKey(variables.userId),
      })
      toast.success(
        i18n.t('toast.assignSuccess', { ns: 'archive-permission' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}
