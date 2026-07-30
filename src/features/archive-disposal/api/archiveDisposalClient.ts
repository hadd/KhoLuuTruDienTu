import type {
  DisposalCandidatesResponseT,
  DisposalProposalCatalogT,
  DisposalProposalItemT,
  GetDisposalCandidatesParamsT,
  TransferToProposalItemT,
} from '@/features/archive-disposal/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'

export async function getDisposalCandidates(
  params?: GetDisposalCandidatesParamsT,
): Promise<DisposalCandidatesResponseT> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
    search: params?.search,
  })
  if (params?.category) searchParams.set('category', params.category)
  if (params?.entityKind) searchParams.set('entityKind', params.entityKind)
  if (params?.fondId) searchParams.set('fondId', params.fondId)
  if (params?.dossierTypeId) searchParams.set('dossierTypeId', params.dossierTypeId)
  if (params?.documentTypeId) searchParams.set('documentTypeId', params.documentTypeId)
  if (params?.inventoryId) searchParams.set('inventoryId', params.inventoryId)
  if (params?.retentionPeriodId) {
    searchParams.set('retentionPeriodId', params.retentionPeriodId)
  }
  if (params?.physicalItemId) {
    searchParams.set('physicalItemId', params.physicalItemId)
  }
  if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom)
  if (params?.dateTo) searchParams.set('dateTo', params.dateTo)

  const response = await apiClient.get<DisposalCandidatesResponseT>(
    `/api/v1/archive-disposal/candidates?${searchParams.toString()}`,
  )
  return response.data
}

export async function getDisposalCatalogs(params?: {
  page?: number
  limit?: number
}): Promise<{
  items: Array<DisposalProposalCatalogT>
  page: number
  limit: number
  total: number
  totalPages: number
}> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
  })
  const response = await apiClient.get<{
    items: Array<DisposalProposalCatalogT>
    page: number
    limit: number
    total: number
    totalPages: number
  }>(`/api/v1/archive-disposal/catalogs?${searchParams.toString()}`)
  return response.data
}

export async function getDisposalCatalog(catalogId: string): Promise<{
  catalog: DisposalProposalCatalogT
  items: Array<DisposalProposalItemT>
}> {
  const response = await apiClient.get<{
    catalog: DisposalProposalCatalogT
    items: Array<DisposalProposalItemT>
  }>(`/api/v1/archive-disposal/catalogs/${encodeURIComponent(catalogId)}`)
  return response.data
}

export async function createDisposalCatalog(input: {
  name: string
  catalogDate: string
  notes?: string
}): Promise<DisposalProposalCatalogT> {
  const response = await apiClient.post<DisposalProposalCatalogT>(
    '/api/v1/archive-disposal/catalogs',
    input,
  )
  return response.data
}

export async function updateDisposalCatalog(
  catalogId: string,
  input: { name?: string; catalogDate?: string; notes?: string | null },
): Promise<DisposalProposalCatalogT> {
  const response = await apiClient.patch<DisposalProposalCatalogT>(
    `/api/v1/archive-disposal/catalogs/${encodeURIComponent(catalogId)}`,
    input,
  )
  return response.data
}

export async function updateDisposalCatalogItem(
  catalogId: string,
  itemId: string,
  input: { reason?: string; notes?: string | null },
): Promise<DisposalProposalItemT> {
  const response = await apiClient.patch<DisposalProposalItemT>(
    `/api/v1/archive-disposal/catalogs/${encodeURIComponent(catalogId)}/items/${encodeURIComponent(itemId)}`,
    input,
  )
  return response.data
}

export async function removeDisposalCatalogItem(
  catalogId: string,
  itemId: string,
): Promise<void> {
  await apiClient.delete(
    `/api/v1/archive-disposal/catalogs/${encodeURIComponent(catalogId)}/items/${encodeURIComponent(itemId)}`,
  )
}

export async function deleteDisposalCatalog(catalogId: string): Promise<void> {
  await apiClient.delete(
    `/api/v1/archive-disposal/catalogs/${encodeURIComponent(catalogId)}`,
  )
}

export async function submitDisposalCatalog(
  catalogId: string,
): Promise<DisposalProposalCatalogT> {
  const response = await apiClient.post<DisposalProposalCatalogT>(
    `/api/v1/archive-disposal/catalogs/${encodeURIComponent(catalogId)}/submit`,
  )
  return response.data
}

export async function transferToDisposalProposal(input: {
  catalogId?: string
  name?: string
  catalogDate?: string
  items: Array<TransferToProposalItemT>
}): Promise<{ catalogId: string; items: Array<DisposalProposalItemT> }> {
  const response = await apiClient.post<{
    catalogId: string
    items: Array<DisposalProposalItemT>
  }>('/api/v1/archive-disposal/transfer-to-proposal', input)
  return response.data
}
