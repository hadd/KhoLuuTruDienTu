import type {
  DocumentTypeT,
  GetDocumentTypesParamsT,
} from '@/features/document-type/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import type { PaginatedResponse } from '@/types/api'

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
