import { apiClient } from '@/lib/api/apiClient'

import type {
  DocumentNamingConfigT,
  DocumentNamingDossierOptionT,
  DocumentNamingFieldCatalogT,
  DocumentNamingPreviewPayloadT,
  DocumentNamingPreviewResponseT,
  DocumentNamingTargetTypeT,
  UpsertDocumentNamingConfigPayloadT,
} from '@/features/document-naming-config/types'

export const getDocumentNamingFieldCatalog =
  async (): Promise<DocumentNamingFieldCatalogT> => {
    const response = await apiClient.get<DocumentNamingFieldCatalogT>(
      '/api/v1/admin/document-naming-configs/field-catalog',
    )
    return response.data
  }

export const getDocumentNamingDossierOptions = async (params: {
  fondId: string
  search?: string
  limit?: number
}): Promise<Array<DocumentNamingDossierOptionT>> => {
  const searchParams = new URLSearchParams()
  searchParams.set('fondId', params.fondId)
  if (params.search) searchParams.set('search', params.search)
  if (params.limit) searchParams.set('limit', String(params.limit))

  const response = await apiClient.get<Array<DocumentNamingDossierOptionT>>(
    `/api/v1/admin/document-naming-configs/dossier-options?${searchParams.toString()}`,
  )
  return response.data
}

export const getDocumentNamingConfig = async (params: {
  fondId: string
  targetType: DocumentNamingTargetTypeT
  dossierId?: string
}): Promise<DocumentNamingConfigT> => {
  const searchParams = new URLSearchParams()
  searchParams.set('fondId', params.fondId)
  searchParams.set('targetType', params.targetType)
  if (params.dossierId) searchParams.set('dossierId', params.dossierId)

  const response = await apiClient.get<DocumentNamingConfigT>(
    `/api/v1/admin/document-naming-configs?${searchParams.toString()}`,
  )
  return response.data
}

export const upsertDocumentNamingConfig = async (
  payload: UpsertDocumentNamingConfigPayloadT,
): Promise<DocumentNamingConfigT> => {
  const response = await apiClient.put<DocumentNamingConfigT>(
    '/api/v1/admin/document-naming-configs',
    payload,
  )
  return response.data
}

export const previewDocumentNamingConfig = async (
  payload: DocumentNamingPreviewPayloadT,
): Promise<DocumentNamingPreviewResponseT> => {
  const response = await apiClient.post<DocumentNamingPreviewResponseT>(
    '/api/v1/admin/document-naming-configs/preview',
    payload,
  )
  return response.data
}
