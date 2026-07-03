import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

import type {
  CreateMetadataExportPresetPayloadT,
  MetadataExportPresetT,
  UpdateMetadataExportPresetPayloadT,
} from '@/features/data-config/types'

export const getMetadataExportPresets = async (): Promise<
  Array<MetadataExportPresetT>
> => {
  const response = await apiClient.get<Array<MetadataExportPresetT>>(
    '/api/v1/admin/metadata-export-presets',
  )
  return response.data
}

export const getMetadataExportPresetOptions = async (): Promise<
  Array<{ id: string; name: string }>
> => {
  const response = await apiClient.get<Array<{ id: string; name: string }>>(
    '/api/v1/admin/metadata-export-presets/export-options',
  )
  return response.data
}

export const getMetadataExportPresetById = async (
  id: string,
): Promise<MetadataExportPresetT> => {
  const response = await apiClient.get<
    SingleResourceResponse<MetadataExportPresetT> | MetadataExportPresetT
  >(`/api/v1/admin/metadata-export-presets/${id}`)

  const data = response.data
  if (data && typeof data === 'object' && 'record' in data) {
    return data.record
  }

  return data as MetadataExportPresetT
}

export const createMetadataExportPreset = async (
  payload: CreateMetadataExportPresetPayloadT,
): Promise<MetadataExportPresetT> => {
  const response = await apiClient.post<
    SingleResourceResponse<MetadataExportPresetT> | MetadataExportPresetT
  >('/api/v1/admin/metadata-export-presets', payload)

  const data = response.data
  if (data && typeof data === 'object' && 'record' in data) {
    return data.record
  }

  return data as MetadataExportPresetT
}

export const updateMetadataExportPreset = async (
  id: string,
  payload: UpdateMetadataExportPresetPayloadT,
): Promise<MetadataExportPresetT> => {
  const response = await apiClient.patch<
    SingleResourceResponse<MetadataExportPresetT> | MetadataExportPresetT
  >(`/api/v1/admin/metadata-export-presets/${id}`, payload)

  const data = response.data
  if (data && typeof data === 'object' && 'record' in data) {
    return data.record
  }

  return data as MetadataExportPresetT
}

export const deleteMetadataExportPreset = async (
  id: string,
): Promise<void> => {
  await apiClient.delete(`/api/v1/admin/metadata-export-presets/${id}`)
}
