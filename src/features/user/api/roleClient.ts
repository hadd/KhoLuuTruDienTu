import type { RoleT } from '@/features/auth/types'
import { apiClient } from '@/lib/api/apiClient'
import type { PaginatedResponse } from '@/types/api'

/** GET /api/v1/admin/roles — adjust unwrap if backend shape differs */
export const getRoles = async (): Promise<Array<RoleT>> => {
  const response = await apiClient.get<PaginatedResponse<RoleT>>('/api/v1/admin/roles')
  return response.data.items
}
