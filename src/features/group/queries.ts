import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { groupApi } from './api/groupApi';
import { createAdminGroup } from './api/groupClient';
import type { CreateAdminGroupPayloadT } from './types';
import type { Member, Group } from './types';
import { toast } from 'sonner'
import i18n from '@/lib/i18n/config'

export const adminGroupsQueryKey = ['admin', 'groups'] as const

export const groupKeys = {
  all: ['groups'] as const,
  lists: () => [...groupKeys.all, 'list'] as const,
  details: () => [...groupKeys.all, 'detail'] as const,
  detail: (id: string) => [...groupKeys.details(), id] as const,
};

export const adminGroupsQueryOptions = () =>
  queryOptions({
    queryKey: adminGroupsQueryKey,
    queryFn: () => groupApi.getGroups(),
    staleTime: 60_000,
  })

export const useGroups = () => {
  return useQuery(adminGroupsQueryOptions());
};

export const useGroup = (id: string) => {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: () => groupApi.getGroupById(id),
    enabled: !!id,
  });
};

export const useAddMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, member }: { groupId: string; member: Omit<Member, 'id' | 'joinedAt'> }) =>
      groupApi.addMemberToGroup(groupId, member),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminGroupsQueryKey });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) });
      toast.success('Thêm thành viên thành công!');
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Có lỗi xảy ra khi thêm thành viên.');
    },
  });
};

export const useDeleteGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => groupApi.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminGroupsQueryKey });
      toast.success('Xóa nhóm thành công!');
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Có lỗi xảy ra khi xóa nhóm.');
    },
  });
};

export const useUpdateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Group> }) => groupApi.updateGroup(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminGroupsQueryKey });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.id) });
      toast.success('Cập nhật nhóm thành công!');
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Có lỗi xảy ra khi cập nhật nhóm.');
    },
  });
};

export const useRemoveMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, memberId }: { groupId: string; memberId: string }) =>
      groupApi.removeMemberFromGroup(groupId, memberId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminGroupsQueryKey });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) });
      toast.success('Xóa thành viên thành công!');
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Có lỗi xảy ra khi xóa thành viên.');
    },
  });
};

export function useCreateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateAdminGroupPayloadT) => createAdminGroup(payload),
    onSuccess: () => {
      toast.success(i18n.t('createDialog.success', { ns: 'group' }))
      void queryClient.invalidateQueries({ queryKey: adminGroupsQueryKey })
    },
    onError: (error: Error) => {
      toast.error(error?.message || i18n.t('createDialog.error', { ns: 'group' }))
    },
  })
}
