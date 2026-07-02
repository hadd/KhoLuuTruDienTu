import type {
  CreateMetadataPermissionConfigPayloadT,
  MetadataPermissionConfigListItemT,
  MetadataPermissionConfigT,
  MetadataPermissionTemplateOptionT,
  UpdateMetadataPermissionConfigSlotsPayloadT,
  UpdateMetadataPermissionConfigStatusPayloadT,
} from '@/features/data-config/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

const BASE_PATH = '/api/v1/admin/metadata-permission-configs'

function unwrapRecord<T>(data: SingleResourceResponse<T> | T): T {
  if (data && typeof data === 'object' && 'record' in data) {
    return data.record
  }
  return data
}

export const getPermissionTemplateOptions = async (): Promise<
  Array<MetadataPermissionTemplateOptionT>
> => {
  const response = await apiClient.get<
    Array<MetadataPermissionTemplateOptionT>
  >(`${BASE_PATH}/template-options`)
  return response.data
}

export const getPermissionConfigs = async (params?: {
  status?: string
}): Promise<Array<MetadataPermissionConfigListItemT>> => {
  const searchParams = new URLSearchParams()
  if (params?.status) {
    searchParams.set('status', params.status)
  }

  const queryString = searchParams.toString()
  const url = `${BASE_PATH}/${queryString ? `?${queryString}` : ''}`

  const response =
    await apiClient.get<Array<MetadataPermissionConfigListItemT>>(url)
  return response.data
}

export const getPermissionConfig = async (
  id: string,
): Promise<MetadataPermissionConfigT> => {
  const response = await apiClient.get<
    | SingleResourceResponse<MetadataPermissionConfigT>
    | MetadataPermissionConfigT
  >(`${BASE_PATH}/${id}`)
  return unwrapRecord(response.data)
}

export const createPermissionConfig = async (
  payload: CreateMetadataPermissionConfigPayloadT,
): Promise<MetadataPermissionConfigT> => {
  const response = await apiClient.post<
    | SingleResourceResponse<MetadataPermissionConfigT>
    | MetadataPermissionConfigT
  >(`${BASE_PATH}/`, payload)
  return unwrapRecord(response.data)
}

export const updatePermissionConfigSlots = async (
  id: string,
  payload: UpdateMetadataPermissionConfigSlotsPayloadT,
): Promise<MetadataPermissionConfigT> => {
  const response = await apiClient.put<
    | SingleResourceResponse<MetadataPermissionConfigT>
    | MetadataPermissionConfigT
  >(`${BASE_PATH}/${id}/slots`, payload)
  return unwrapRecord(response.data)
}

export const deletePermissionConfig = async (id: string): Promise<void> => {
  await apiClient.delete(`${BASE_PATH}/${id}`)
}

export const updatePermissionConfigStatus = async (
  id: string,
  payload: UpdateMetadataPermissionConfigStatusPayloadT,
): Promise<MetadataPermissionConfigT> => {
  const response = await apiClient.patch<
    | SingleResourceResponse<MetadataPermissionConfigT>
    | MetadataPermissionConfigT
  >(`${BASE_PATH}/${id}/status`, payload)
  return unwrapRecord(response.data)
}
