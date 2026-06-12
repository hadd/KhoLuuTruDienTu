import type {
  AdminGroupT,
  AdminGroupsListResponseT,
  AssignGroupByFolderPayloadT,
  AssignGroupByFolderResponseT,
  AvailableEditorsResponseT,
  CreateAdminGroupPayloadT,
  UpdateAdminGroupPayloadT,
} from '@/features/group/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

export const getAvailableEditors =
  async (): Promise<AvailableEditorsResponseT> => {
    const response = await apiClient.get<AvailableEditorsResponseT>(
      '/api/v1/admin/groups/available-editors',
    )
    return response.data
  }

export const getAdminGroups = async (): Promise<AdminGroupsListResponseT> => {
  const response = await apiClient.get<AdminGroupsListResponseT>(
    '/api/v1/admin/groups/',
  )
  return response.data
}

export const createAdminGroup = async (
  payload: CreateAdminGroupPayloadT,
): Promise<AdminGroupT> => {
  const response = await apiClient.post<SingleResourceResponse<AdminGroupT>>(
    '/api/v1/admin/groups/',
    payload,
  )
  return response.data.record
}

export const updateAdminGroup = async (
  groupId: string,
  payload: UpdateAdminGroupPayloadT,
): Promise<AdminGroupT> => {
  const response = await apiClient.patch<SingleResourceResponse<AdminGroupT>>(
    `/api/v1/admin/groups/${encodeURIComponent(groupId)}`,
    payload,
  )
  return response.data.record
}

/** POST /api/v1/admin/groups/:id/assign-by-folder */
export const assignGroupByFolder = async (
  groupId: string,
  payload: AssignGroupByFolderPayloadT,
): Promise<AssignGroupByFolderResponseT> => {
  const response = await apiClient.post<AssignGroupByFolderResponseT>(
    `/api/v1/admin/groups/${encodeURIComponent(groupId)}/assign-by-folder`,
    payload,
  )
  return response.data
}

export const deleteAdminGroup = async (groupId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/admin/groups/${encodeURIComponent(groupId)}`)
}
