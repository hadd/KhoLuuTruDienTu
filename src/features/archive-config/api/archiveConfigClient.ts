import type {
  ArchiveFieldConfigT,
  CreateArchiveFieldConfigPayloadT,
  UpdateArchiveFieldConfigPayloadT,
} from '@/features/archive-config/types'
import { apiClient } from '@/lib/api/apiClient'

export async function getArchiveFieldConfigs(): Promise<Array<ArchiveFieldConfigT>> {
  const response = await apiClient.get<{ items: Array<ArchiveFieldConfigT> }>(
    '/api/v1/admin/archive-field-configs',
  )
  return response.data.items
}

export async function createArchiveFieldConfig(
  payload: CreateArchiveFieldConfigPayloadT,
): Promise<ArchiveFieldConfigT> {
  const response = await apiClient.post<{ record: ArchiveFieldConfigT }>(
    '/api/v1/admin/archive-field-configs',
    payload,
  )
  return response.data.record
}

export async function updateArchiveFieldConfig(
  id: string,
  payload: UpdateArchiveFieldConfigPayloadT,
): Promise<ArchiveFieldConfigT> {
  const response = await apiClient.put<{ record: ArchiveFieldConfigT }>(
    `/api/v1/admin/archive-field-configs/${id}`,
    payload,
  )
  return response.data.record
}

export async function deleteArchiveFieldConfig(
  id: string,
): Promise<ArchiveFieldConfigT> {
  const response = await apiClient.delete<{ record: ArchiveFieldConfigT }>(
    `/api/v1/admin/archive-field-configs/${id}`,
  )
  return response.data.record
}

export async function reorderArchiveFieldConfigs(
  ids: Array<string>,
): Promise<Array<ArchiveFieldConfigT>> {
  const response = await apiClient.put<{ items: Array<ArchiveFieldConfigT> }>(
    '/api/v1/admin/archive-field-configs/reorder',
    { ids },
  )
  return response.data.items
}
