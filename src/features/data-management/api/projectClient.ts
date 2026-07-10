import type { ProjectsListResponseT } from '@/features/data-management/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'

export type GetProjectsParams = {
  limit?: number
  offset?: number
}

export async function getProjects(
  params?: GetProjectsParams,
): Promise<ProjectsListResponseT> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    limit: params?.limit ?? 50,
    paging: false,
  })
  if (params?.offset != null) {
    searchParams.set('offset', String(params.offset))
  }

  const queryString = searchParams.toString()
  const url = `/api/v1/admin/projects/options${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<ProjectsListResponseT>(url)
  return response.data
}
