import type {
  CreateProjectPlanPayloadT,
  GetProjectPlansParamsT,
  ProjectPlanDetailItemT,
  ProjectPlansListResponseT,
  ProjectPlanT,
  UpdateProjectPlanDetailsPayloadT,
  UpdateProjectPlanPayloadT,
} from '@/features/plan-management/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

const BASE_PATH = '/api/v1/project-plans'

function unwrapProjectPlan(
  data: SingleResourceResponse<ProjectPlanT> | ProjectPlanT,
): ProjectPlanT {
  if (typeof data === 'object' && 'record' in data) {
    return data.record
  }

  return data
}

export const getProjectPlans = async (
  params: GetProjectPlansParamsT,
): Promise<ProjectPlansListResponseT> => {
  const searchParams = new URLSearchParams()

  if (params.projectCode?.trim()) {
    searchParams.set('projectCode', params.projectCode.trim())
  }

  if (params.limit != null && params.limit > 0) {
    searchParams.set('limit', String(params.limit))
  }
  if (params.offset != null && params.offset >= 0) {
    searchParams.set('offset', String(params.offset))
  }

  const queryString = searchParams.toString()
  const url = queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH

  const response = await apiClient.get<ProjectPlansListResponseT>(url)
  return response.data
}

export const createProjectPlan = async (
  payload: CreateProjectPlanPayloadT,
): Promise<ProjectPlanT> => {
  const response = await apiClient.post<
    SingleResourceResponse<ProjectPlanT> | ProjectPlanT
  >(BASE_PATH, payload)
  return unwrapProjectPlan(response.data)
}

export const getProjectPlanById = async (id: string): Promise<ProjectPlanT> => {
  const response = await apiClient.get<
    SingleResourceResponse<ProjectPlanT> | ProjectPlanT
  >(`${BASE_PATH}/${encodeURIComponent(id)}`)
  return unwrapProjectPlan(response.data)
}

export const updateProjectPlan = async (
  id: string,
  payload: UpdateProjectPlanPayloadT,
): Promise<ProjectPlanT> => {
  const response = await apiClient.patch<
    SingleResourceResponse<ProjectPlanT> | ProjectPlanT
  >(`${BASE_PATH}/${encodeURIComponent(id)}`, payload)
  return unwrapProjectPlan(response.data)
}

export const deleteProjectPlan = async (id: string): Promise<void> => {
  await apiClient.delete(`${BASE_PATH}/${encodeURIComponent(id)}`)
}

export const getProjectPlanDetails = async (
  planId: string,
): Promise<Array<ProjectPlanDetailItemT>> => {
  const response = await apiClient.get<Array<ProjectPlanDetailItemT>>(
    `${BASE_PATH}/${encodeURIComponent(planId)}/detail`,
  )
  return response.data
}

export const updateProjectPlanDetails = async (
  planId: string,
  payload: UpdateProjectPlanDetailsPayloadT,
): Promise<Array<ProjectPlanDetailItemT>> => {
  const response = await apiClient.put<Array<ProjectPlanDetailItemT>>(
    `${BASE_PATH}/${encodeURIComponent(planId)}/detail`,
    payload,
  )
  return response.data
}
