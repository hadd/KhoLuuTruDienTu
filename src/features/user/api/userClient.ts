import type { UserT } from '@/features/auth/types'
import type {
  AdminUserCreatePayloadT,
  AdminUserUpdatePayloadT,
} from '@/features/user/types'
import { apiClient } from '@/lib/api/apiClient'
import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'

export const getAllUsers = async (): Promise<PaginatedResponse<UserT>> => {
  const response = await apiClient.get<PaginatedResponse<UserT>>(
    '/api/v1/admin/users/all',
  )
  return response.data
}

export const createUser = async (data: AdminUserCreatePayloadT): Promise<UserT> => {
  const response = await apiClient.post<SingleResourceResponse<UserT>>(
    '/api/v1/admin/users',
    data,
  )
  return response.data.record
}

export const updateUser = async (
  id: string,
  data: AdminUserUpdatePayloadT,
): Promise<UserT> => {
  const response = await apiClient.put<SingleResourceResponse<UserT>>(
    `/api/v1/admin/users/${id}`,
    data,
  )
  return response.data.record
}

export const deleteUser = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/v1/admin/users/${id}`)
}
