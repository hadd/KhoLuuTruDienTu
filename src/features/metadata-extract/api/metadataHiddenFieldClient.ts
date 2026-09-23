import { apiClient } from '@/lib/api/apiClient'

export type MetadataHiddenFieldItemT = {
  id: string
  metadataExtractModeCode: string
  fieldCode: string
  groupCode: string | null
  description: string | null
  isHidden: boolean
  createdAt: string
  updatedAt: string
}

export type CreateMetadataHiddenFieldInputT = {
  metadataExtractModeCode?: string
  fieldCode: string
  groupCode?: string | null
  description?: string | null
  isHidden?: boolean
}

export type UpdateMetadataHiddenFieldInputT = {
  metadataExtractModeCode?: string
  fieldCode?: string
  groupCode?: string | null
  description?: string | null
  isHidden?: boolean
}

export type MetadataFieldQueryT = {
  metadataExtractModeCode?: string
  groupCode?: string
  fieldCode?: string
  description?: string
  isHidden?: boolean | string
  search?: string
}

export async function getMetadataHiddenFields(
  params?: MetadataFieldQueryT,
): Promise<Array<MetadataHiddenFieldItemT>> {
  const response = await apiClient.get<{ data: Array<MetadataHiddenFieldItemT> }>(
    '/api/v1/metadata-fields',
    { params },
  )
  return response.data.data
}

export async function getActiveMetadataHiddenFields(
  params?: MetadataFieldQueryT,
): Promise<Array<string>> {
  const response = await apiClient.get<{ activeHiddenFields: Array<string> }>(
    '/api/v1/metadata-fields/active',
    { params },
  )
  return response.data.activeHiddenFields
}

export async function createMetadataHiddenField(
  input: CreateMetadataHiddenFieldInputT,
): Promise<MetadataHiddenFieldItemT> {
  const response = await apiClient.post<{ data: MetadataHiddenFieldItemT }>(
    '/api/v1/metadata-fields',
    input,
  )
  return response.data.data
}

export async function updateMetadataHiddenField(
  id: string,
  input: UpdateMetadataHiddenFieldInputT,
): Promise<MetadataHiddenFieldItemT> {
  const response = await apiClient.put<{ data: MetadataHiddenFieldItemT }>(
    `/api/v1/metadata-fields/${id}`,
    input,
  )
  return response.data.data
}

export async function deleteMetadataHiddenField(
  id: string,
): Promise<MetadataHiddenFieldItemT> {
  const response = await apiClient.delete<{ data: MetadataHiddenFieldItemT }>(
    `/api/v1/metadata-fields/${id}`,
  )
  return response.data.data
}
