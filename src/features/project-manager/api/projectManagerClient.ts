import { normalizeProjectFromApi } from '@/features/project-manager/lib/normalizeProject'
import type {
  CreateProjectPayloadT,
  GetProjectsParamsT,
  ProjectProgressHistoryT,
  ProjectsListResponseT,
  ProjectT,
  UpdateProjectPayloadT,
} from '@/features/project-manager/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

const PROJECT_DETAIL_LIST_LIMIT = 500

function unwrapProjectResponse(data: unknown): ProjectT {
  if (data && typeof data === 'object' && 'record' in data) {
    return normalizeProjectFromApi(
      (data as SingleResourceResponse<unknown>).record,
    )
  }

  if (data && typeof data === 'object' && 'data' in data) {
    return normalizeProjectFromApi((data as { data: unknown }).data)
  }

  return normalizeProjectFromApi(data)
}

async function findProjectInList(projectId: string): Promise<ProjectT | null> {
  const response = await getProjects({
    limit: PROJECT_DETAIL_LIST_LIMIT,
    page: 1,
  })

  return response.items.find((item) => item.projectCode === projectId) ?? null
}

export const getProjects = async (
  params?: GetProjectsParamsT,
): Promise<ProjectsListResponseT> => {
  const searchParams = new URLSearchParams()

  if (params?.limit != null && params.limit > 0) {
    searchParams.set('limit', String(params.limit))
  }
  if (params?.page != null && params.page > 0) {
    searchParams.set('page', String(params.page))
  }
  if (params?.search?.trim()) {
    searchParams.set('search', params.search.trim())
  }

  const queryString = searchParams.toString()
  const url = `/api/v1/admin/projects/${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<ProjectsListResponseT>(url)

  return {
    ...response.data,
    items: response.data.items.map((item) => normalizeProjectFromApi(item)),
  }
}

export const getProjectDetail = async (
  projectId: string,
): Promise<ProjectT> => {
  const encodedId = encodeURIComponent(projectId)

  for (const url of [
    `/api/v1/admin/projects/${encodedId}`,
    `/api/v1/admin/projects/${encodedId}/`,
  ]) {
    try {
      const response = await apiClient.get<
        SingleResourceResponse<unknown> | ProjectT
      >(url)
      return unwrapProjectResponse(response.data)
    } catch {
      continue
    }
  }

  const project = await findProjectInList(projectId)
  if (!project) {
    throw new Error('Project not found')
  }

  return project
}

export const getProjectProgressHistory = async (
  projectId: string,
): Promise<Array<ProjectProgressHistoryT>> => {
  const response = await apiClient.get<Array<ProjectProgressHistoryT>>(
    `/api/v1/admin/projects/${encodeURIComponent(projectId)}/progress-history`,
  )
  return response.data
}

export const createProject = async (
  payload: CreateProjectPayloadT,
): Promise<ProjectT> => {
  const response = await apiClient.post<
    SingleResourceResponse<ProjectT> | ProjectT
  >('/api/v1/admin/projects/', payload)
  return unwrapProjectResponse(response.data)
}

export const updateProject = async (
  projectId: string,
  payload: UpdateProjectPayloadT,
): Promise<ProjectT> => {
  const response = await apiClient.patch<
    SingleResourceResponse<ProjectT> | ProjectT
  >(`/api/v1/admin/projects/${encodeURIComponent(projectId)}`, payload)
  return unwrapProjectResponse(response.data)
}

export const deleteProject = async (projectId: string): Promise<void> => {
  await apiClient.delete(
    `/api/v1/admin/projects/${encodeURIComponent(projectId)}`,
  )
}
