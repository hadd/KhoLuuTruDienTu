import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

import type {
  CreateMetadataTemplatePayloadT,
  MetadataTemplateDossierOptionT,
  MetadataTemplateT,
  UpdateMetadataTemplatePayloadT,
} from '@/features/data-config/types'

export const getMetadataTemplates = async (): Promise<
  Array<MetadataTemplateT>
> => {
  const response = await apiClient.get<Array<MetadataTemplateT>>(
    '/api/v1/admin/metadata-templates',
  )
  return response.data
}

export const getMetadataTemplateDossierOptions = async (): Promise<
  Array<MetadataTemplateDossierOptionT>
> => {
  const response = await apiClient.get<Array<MetadataTemplateDossierOptionT>>(
    '/api/v1/admin/metadata-templates/dossier-options',
  )
  return response.data
}

export const getMetadataTemplateById = async (
  id: string,
): Promise<MetadataTemplateT> => {
  const response = await apiClient.get<
    SingleResourceResponse<MetadataTemplateT> | MetadataTemplateT
  >(`/api/v1/admin/metadata-templates/${id}`)

  const data = response.data
  if (data && typeof data === 'object' && 'record' in data) {
    return data.record
  }

  return data as MetadataTemplateT
}

export const createMetadataTemplate = async (
  payload: CreateMetadataTemplatePayloadT,
): Promise<MetadataTemplateT> => {
  const response = await apiClient.post<
    SingleResourceResponse<MetadataTemplateT> | MetadataTemplateT
  >('/api/v1/admin/metadata-templates', payload)

  const data = response.data
  if (data && typeof data === 'object' && 'record' in data) {
    return data.record
  }

  return data as MetadataTemplateT
}

export const updateMetadataTemplate = async (
  id: string,
  payload: UpdateMetadataTemplatePayloadT,
): Promise<MetadataTemplateT> => {
  const response = await apiClient.patch<
    SingleResourceResponse<MetadataTemplateT> | MetadataTemplateT
  >(`/api/v1/admin/metadata-templates/${id}`, payload)

  const data = response.data
  if (data && typeof data === 'object' && 'record' in data) {
    return data.record
  }

  return data as MetadataTemplateT
}
