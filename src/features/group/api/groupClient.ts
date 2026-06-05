import type {
  AdminGroupT,
  AdminGroupsListResponseT,
  CreateAdminGroupPayloadT,
} from '@/features/group/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

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
