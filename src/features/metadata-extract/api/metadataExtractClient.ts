import { apiClient } from '@/lib/api/apiClient'

export type MetadataExtractMode = 'old' | 'tt05' | 'off'

export type MetadataExtractSettingsT = {
  id: string
  mode: MetadataExtractMode
  updatedById: string | null
  updatedAt: string
  createdAt: string
}

export async function getMetadataExtractSettings(): Promise<MetadataExtractSettingsT> {
  const response = await apiClient.get<MetadataExtractSettingsT>(
    '/api/v1/metadata/extract-settings',
  )
  return response.data
}

export async function updateMetadataExtractSettings(input: {
  mode: MetadataExtractMode
}): Promise<MetadataExtractSettingsT> {
  const response = await apiClient.put<MetadataExtractSettingsT>(
    '/api/v1/metadata/extract-settings',
    input,
  )
  return response.data
}
