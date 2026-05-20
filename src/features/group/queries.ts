import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { groupApi } from './api/groupApi';
import type { Member,Group } from './types';
import { toast } from 'sonner'
export const groupKeys = {
  all: ['groups'] as const,
  lists: () => [...groupKeys.all, 'list'] as const,
  details: () => [...groupKeys.all, 'detail'] as const,
  detail: (id: string) => [...groupKeys.details(), id] as const,
};

export const useGroups = () => {
  return useQuery({
    queryKey: groupKeys.lists(),
    queryFn: () => groupApi.getGroups(),
  });
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
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) });
      toast.success('Thêm thành viên thành công!');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Có lỗi xảy ra khi thêm thành viên.');
    },
  });
};

export const useDeleteGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => groupApi.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
      toast.success('Xóa nhóm thành công!');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Có lỗi xảy ra khi xóa nhóm.');
    },
  });
};

export const useUpdateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Group> }) => groupApi.updateGroup(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.id) });
      toast.success('Cập nhật nhóm thành công!');
    },
    onError: (error: any) => {
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
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) });
      toast.success('Xóa thành viên thành công!');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Có lỗi xảy ra khi xóa thành viên.');
    },
  });
};
async function createGroupApi(payload: { name: string; description: string; adminIds: Array<string>; reviewerIds?: Array<string> }) {

  console.log('[API Đang gọi tạo nhóm với dữ liệu:]', payload)
  return new Promise((resolve) => setTimeout(resolve, 1000)) // Giả lập delay mạng 1s
}

export function useCreateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createGroupApi,
    onSuccess: () => {

      toast.success('Tạo nhóm mới thành công!')

      void queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
    onError: (error: any) => {
     
      toast.error(error?.message || 'Có lỗi xảy ra khi tạo nhóm.')
    },
  })
}