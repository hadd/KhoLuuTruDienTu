import type {
  CreateDossierTypePayloadT,
  DossierTypeT,
  GetDossierTypesParamsT,
  UpdateDossierTypePayloadT,
} from '@/features/dossier-type/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'

export async function getDossierTypes(
  params?: GetDossierTypesParamsT,
): Promise<PaginatedResponse<DossierTypeT>> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
    search: params?.search,
  })

  const queryString = searchParams.toString()
  const url = `/api/v1/dossier-types${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<PaginatedResponse<DossierTypeT>>(url)
  return response.data
}

export async function createDossierTypeRecord(
  payload: CreateDossierTypePayloadT,
): Promise<DossierTypeT> {
  const response = await apiClient.post<SingleResourceResponse<DossierTypeT>>(
    '/api/v1/dossier-types',
    payload,
  )
  return response.data.record
}

export async function updateDossierTypeRecord(
  id: string,
  payload: UpdateDossierTypePayloadT,
): Promise<DossierTypeT> {
  const response = await apiClient.put<SingleResourceResponse<DossierTypeT>>(
    `/api/v1/dossier-types/${id}`,
    payload,
  )
  return response.data.record
}

export async function deleteDossierTypeRecord(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/dossier-types/${id}`)
}
