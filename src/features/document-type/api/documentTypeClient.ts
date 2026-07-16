import type {
  CreateDocumentTypePayloadT,
  DocumentTypeT,
  GetDocumentTypesParamsT,
  UpdateDocumentTypePayloadT,
} from '@/features/document-type/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'

export async function getDocumentTypes(
  params?: GetDocumentTypesParamsT,
): Promise<PaginatedResponse<DocumentTypeT>> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
    search: params?.search,
  })

  const queryString = searchParams.toString()
  const url = `/api/v1/document-types${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<PaginatedResponse<DocumentTypeT>>(url)
  return response.data
}

export async function createDocumentTypeRecord(
  payload: CreateDocumentTypePayloadT,
): Promise<DocumentTypeT> {
  const response = await apiClient.post<SingleResourceResponse<DocumentTypeT>>(
    '/api/v1/document-types',
    payload,
  )
  return response.data.record
}

export async function updateDocumentTypeRecord(
  id: string,
  payload: UpdateDocumentTypePayloadT,
): Promise<DocumentTypeT> {
  const response = await apiClient.put<SingleResourceResponse<DocumentTypeT>>(
    `/api/v1/document-types/${id}`,
    payload,
  )
  return response.data.record
}

export async function deleteDocumentTypeRecord(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/document-types/${id}`)
}
