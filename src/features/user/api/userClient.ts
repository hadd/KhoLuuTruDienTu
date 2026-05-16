import type { UserT } from '@/features/auth/types'
import { apiClient } from '@/lib/api/apiClient'
import type { PaginatedResponse } from '@/types/api'

export const getAllUsers = async (): Promise<PaginatedResponse<UserT>> => {
  const response = await apiClient.get<PaginatedResponse<UserT>>(
    '/api/v1/admin/users/all',
  )
  return response.data
}
