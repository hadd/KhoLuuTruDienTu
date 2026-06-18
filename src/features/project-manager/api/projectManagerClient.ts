import type {
  CreateProjectPayloadT,
  GetProjectsParamsT,
  ProjectProgressHistoryT,
  ProjectT,
  ProjectsListResponseT,
  UpdateProjectPayloadT,
} from '@/features/project-manager/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

const PROJECTS_LIST_LIMIT = 50

export const getProjects = async (
  params?: GetProjectsParamsT,
): Promise<ProjectsListResponseT> => {
  const searchParams = new URLSearchParams()

  if (params?.limit != null && params.limit > 0) {
    searchParams.set('limit', String(params.limit))
  }
  if (params?.offset != null && params.offset >= 0) {
    searchParams.set('offset', String(params.offset))
  }

  const queryString = searchParams.toString()
  const url = `/api/v1/admin/projects/${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<ProjectsListResponseT>(url)
  return response.data
}

/** Tạm thời lấy chi tiết từ danh sách cho đến khi có GET by id */
export const getProjectDetail = async (
  projectId: string,
): Promise<ProjectT> => {
  const response = await getProjects({ limit: PROJECTS_LIST_LIMIT })
  const project = response.items.find((item) => item.projectCode === projectId)

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
  const response = await apiClient.post<SingleResourceResponse<ProjectT>>(
    '/api/v1/admin/projects/',
    payload,
  )
  return response.data.record
}

export const updateProject = async (
  projectId: string,
  payload: UpdateProjectPayloadT,
): Promise<ProjectT> => {
  const response = await apiClient.patch<SingleResourceResponse<ProjectT>>(
    `/api/v1/admin/projects/${encodeURIComponent(projectId)}`,
    payload,
  )
  return response.data.record
}

export const deleteProject = async (projectId: string): Promise<void> => {
  await apiClient.delete(
    `/api/v1/admin/projects/${encodeURIComponent(projectId)}`,
  )
}
