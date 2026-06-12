import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { groupApi } from './api/groupApi'
import {
  assignGroupByFolder,
  createAdminGroup,
  getAvailableEditors,
} from './api/groupClient'
import {
  getMetadataPermissionConfigs,
  updateGroupMetadataPermissionConfig,
  updateGroupPermissionAssignments,
} from './api/metadataApi'
import { buildUpdateGroupPayload } from '@/features/group/lib/groupPayload'
import type {
  AssignGroupByFolderPayloadT,
  CreateAdminGroupPayloadT,
  UpdateAdminGroupPayloadT,
  UpdateGroupPermissionAssignmentsPayloadT,
} from './types'
import type { Group, Member } from './types'
import { toast } from 'sonner'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const adminGroupsQueryKey = ['admin', 'groups'] as const

export const availableEditorsQueryKey = ['admin', 'groups', 'available-editors'] as const

export const metadataPermissionConfigsQueryKey = [
  'admin',
  'metadata-permission-configs',
] as const

export const groupKeys = {
  all: ['groups'] as const,
  lists: () => [...groupKeys.all, 'list'] as const,
  details: () => [...groupKeys.all, 'detail'] as const,
  detail: (id: string) => [...groupKeys.details(), id] as const,
}

export const adminGroupsQueryOptions = () =>
  queryOptions({
    queryKey: adminGroupsQueryKey,
    queryFn: () => groupApi.getGroups(),
    staleTime: 60_000,
  })

export const availableEditorsQueryOptions = () =>
  queryOptions({
    queryKey: availableEditorsQueryKey,
    queryFn: () => getAvailableEditors(),
    staleTime: 60_000,
  })

export const useUpdateGroup = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateAdminGroupPayloadT
    }) => groupApi.updateGroup(id, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminGroupsQueryKey })
      void queryClient.invalidateQueries({
        queryKey: groupKeys.detail(variables.id),
      })
      toast.success(i18n.t('update.success', { ns: 'group' }))
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) || i18n.t('update.error', { ns: 'group' }),
      )
    },
  })
}

export const useDeleteGroup = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => groupApi.deleteGroup(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminGroupsQueryKey })
      toast.success(i18n.t('delete.success', { ns: 'group' }))
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) || i18n.t('delete.error', { ns: 'group' }),
      )
    },
  })
}

export const useRemoveMember = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ group, member }: { group: Group; member: Member }) => {
      if (member.role !== 'member') {
        throw new Error(i18n.t('removeMember.unsupportedRole', { ns: 'group' }))
      }

      const payload = buildUpdateGroupPayload(group, {
        editorIds: group.editorUserIds.filter(
          (userId) => userId !== member.userId,
        ),
      })

      return groupApi.updateGroup(group.id, payload)
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminGroupsQueryKey })
      void queryClient.invalidateQueries({
        queryKey: groupKeys.detail(variables.group.id),
      })
      toast.success(i18n.t('removeMember.success', { ns: 'group' }))
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) || i18n.t('removeMember.error', { ns: 'group' }),
      )
    },
  })
}

export function useCreateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateAdminGroupPayloadT) =>
      createAdminGroup(payload),
    onSuccess: () => {
      toast.success(i18n.t('createDialog.success', { ns: 'group' }))
      void queryClient.invalidateQueries({ queryKey: adminGroupsQueryKey })
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) || i18n.t('createDialog.error', { ns: 'group' }),
      )
    },
  })
}

export function useAssignGroupByFolderMutation() {
  return useMutation({
    mutationFn: ({
      groupId,
      payload,
    }: {
      groupId: string
      payload: AssignGroupByFolderPayloadT
    }) => assignGroupByFolder(groupId, payload),
  })
}

export const metadataPermissionConfigsQueryOptions = () =>
  queryOptions({
    queryKey: metadataPermissionConfigsQueryKey,
    queryFn: () => getMetadataPermissionConfigs(),
    staleTime: 60_000,
  })

export function useAssignGroupMetadataPermissionConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId,
      permissionConfigId,
    }: {
      groupId: string
      permissionConfigId: string
    }) => {
      await updateGroupMetadataPermissionConfig(groupId, { permissionConfigId })
      await getMetadataPermissionConfigs()
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: metadataPermissionConfigsQueryKey,
      })
      void queryClient.invalidateQueries({ queryKey: adminGroupsQueryKey })
      void queryClient.invalidateQueries({
        queryKey: groupKeys.detail(variables.groupId),
      })
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) ||
          i18n.t('permissionAssignments.assignConfigError', { ns: 'group' }),
      )
    },
  })
}

export function useUpdateGroupPermissionAssignments() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      groupId,
      payload,
    }: {
      groupId: string
      payload: UpdateGroupPermissionAssignmentsPayloadT
    }) => updateGroupPermissionAssignments(groupId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminGroupsQueryKey })
      void queryClient.invalidateQueries({
        queryKey: groupKeys.detail(variables.groupId),
      })
      toast.success(i18n.t('permissionAssignments.success', { ns: 'group' }))
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) ||
          i18n.t('permissionAssignments.error', { ns: 'group' }),
      )
    },
  })
}
