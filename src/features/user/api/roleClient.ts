import type { AdminRoleT } from '@/features/user/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

/** GET /api/v1/admin/users/roles */
export const getRoles = async (): Promise<Array<AdminRoleT>> => {
  const response = await apiClient.get<
    SingleResourceResponse<Array<AdminRoleT>>
  >('/api/v1/admin/users/roles')
  return response.data.record || []
}
