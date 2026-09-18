import { apiClient } from '@/lib/api/apiClient'

import type { MetadataExtractMode } from '@/features/metadata-extract/config/metadataExtractModes'

export {
  METADATA_EXTRACT_MODES,
  METADATA_EXTRACT_MODE_CONFIG,
  METADATA_EXTRACT_MODE_LABELS,
  DEFAULT_METADATA_EXTRACT_MODE,
  getMetadataExtractModeOptions,
  getMetadataExtractModeSelectOptions,
  getMetadataExtractModeLabel,
  getMetadataExtractModeDescription,
  type MetadataExtractMode,
  type MetadataExtractModeMeta,
} from '@/features/metadata-extract/config/metadataExtractModes'

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
