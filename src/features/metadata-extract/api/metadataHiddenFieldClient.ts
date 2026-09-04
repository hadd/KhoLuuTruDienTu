import { apiClient } from '@/lib/api/apiClient'

export type MetadataHiddenFieldItemT = {
  id: string
  fieldCode: string
  groupCode: string | null
  description: string | null
  isHidden: boolean
  createdAt: string
  updatedAt: string
}

export type CreateMetadataHiddenFieldInputT = {
  fieldCode: string
  groupCode?: string | null
  description?: string | null
  isHidden?: boolean
}

export type UpdateMetadataHiddenFieldInputT = {
  fieldCode?: string
  groupCode?: string | null
  description?: string | null
  isHidden?: boolean
}

export async function getMetadataHiddenFields(): Promise<Array<MetadataHiddenFieldItemT>> {
  const response = await apiClient.get<{ data: Array<MetadataHiddenFieldItemT> }>(
    '/api/v1/metadata-hidden-fields',
  )
  return response.data.data
}

export async function getActiveMetadataHiddenFields(): Promise<Array<string>> {
  const response = await apiClient.get<{ activeHiddenFields: Array<string> }>(
    '/api/v1/metadata-hidden-fields/active',
  )
  return response.data.activeHiddenFields
}

export async function createMetadataHiddenField(
  input: CreateMetadataHiddenFieldInputT,
): Promise<MetadataHiddenFieldItemT> {
  const response = await apiClient.post<{ data: MetadataHiddenFieldItemT }>(
    '/api/v1/metadata-hidden-fields',
    input,
  )
  return response.data.data
}

export async function updateMetadataHiddenField(
  id: string,
  input: UpdateMetadataHiddenFieldInputT,
): Promise<MetadataHiddenFieldItemT> {
  const response = await apiClient.put<{ data: MetadataHiddenFieldItemT }>(
    `/api/v1/metadata-hidden-fields/${id}`,
    input,
  )
  return response.data.data
}

export async function deleteMetadataHiddenField(
  id: string,
): Promise<MetadataHiddenFieldItemT> {
  const response = await apiClient.delete<{ data: MetadataHiddenFieldItemT }>(
    `/api/v1/metadata-hidden-fields/${id}`,
  )
  return response.data.data
}
