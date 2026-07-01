import type {
  CreateProjectPlanPayloadT,
  GetProjectPlansParamsT,
  ProjectPlansListResponseT,
  ProjectPlanT,
  UpdateProjectPlanPayloadT,
} from '@/features/plan-management/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

function unwrapProjectPlan(
  data: SingleResourceResponse<ProjectPlanT> | ProjectPlanT,
): ProjectPlanT {
  if (data && typeof data === 'object' && 'record' in data) {
    return data.record
  }

  return data
}

export const getProjectPlans = async (
  params: GetProjectPlansParamsT,
): Promise<ProjectPlansListResponseT> => {
  const searchParams = new URLSearchParams()
  searchParams.set('projectCode', params.projectCode)

  if (params.limit != null && params.limit > 0) {
    searchParams.set('limit', String(params.limit))
  }
  if (params.offset != null && params.offset >= 0) {
    searchParams.set('offset', String(params.offset))
  }

  const response = await apiClient.get<ProjectPlansListResponseT>(
    `/api/v1/admin/project-plans/?${searchParams.toString()}`,
  )
  return response.data
}

export const createProjectPlan = async (
  payload: CreateProjectPlanPayloadT,
): Promise<ProjectPlanT> => {
  const response = await apiClient.post<
    SingleResourceResponse<ProjectPlanT> | ProjectPlanT
  >('/api/v1/admin/project-plans/', payload)
  return unwrapProjectPlan(response.data)
}

export const getProjectPlanById = async (id: string): Promise<ProjectPlanT> => {
  const response = await apiClient.get<
    SingleResourceResponse<ProjectPlanT> | ProjectPlanT
  >(`/api/v1/admin/project-plans/${encodeURIComponent(id)}`)
  return unwrapProjectPlan(response.data)
}

export const updateProjectPlan = async (
  id: string,
  payload: UpdateProjectPlanPayloadT,
): Promise<ProjectPlanT> => {
  const response = await apiClient.patch<
    SingleResourceResponse<ProjectPlanT> | ProjectPlanT
  >(`/api/v1/admin/project-plans/${encodeURIComponent(id)}`, payload)
  return unwrapProjectPlan(response.data)
}

export const deleteProjectPlan = async (id: string): Promise<void> => {
  await apiClient.delete(
    `/api/v1/admin/project-plans/${encodeURIComponent(id)}`,
  )
}
