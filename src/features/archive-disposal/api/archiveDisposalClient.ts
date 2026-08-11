import type {
  DisposalCandidatesResponseT,
  DisposalCatalogDetailT,
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

export async function getDisposalCatalog(catalogId: string): Promise<DisposalCatalogDetailT> {
  const response = await apiClient.get<DisposalCatalogDetailT>(
    `/api/v1/archive-disposal/catalogs/${encodeURIComponent(catalogId)}`,
  )
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
}): Promise<TransferToProposalResultT> {
  const response = await apiClient.post<TransferToProposalResultT>(
    '/api/v1/archive-disposal/transfer-to-proposal',
    input,
  )
  return response.data
}

function filenameFromContentDisposition(header: string | undefined): string | null {
  if (!header) return null
  const match = /filename="([^"]+)"/i.exec(header)
  return match?.[1] ?? null
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

const appendixExportInFlight = new Map<string, Promise<void>>()

async function downloadDisposalAppendixExport(
  catalogId: string,
  appendix: 'phu-luc-ii' | 'phu-luc-iii',
): Promise<void> {
  const flightKey = `${catalogId}:${appendix}`
  const existing = appendixExportInFlight.get(flightKey)
  if (existing) return existing

  const task = (async () => {
    const response = await apiClient.get<Blob>(
      `/api/v1/archive-disposal/catalogs/${encodeURIComponent(catalogId)}/export/${appendix}`,
      { responseType: 'blob' },
    )
    const filename =
      filenameFromContentDisposition(response.headers['content-disposition']) ??
      `export-${appendix}.pdf`
    triggerBrowserDownload(response.data, filename)
  })()

  appendixExportInFlight.set(flightKey, task)
  try {
    await task
  } finally {
    appendixExportInFlight.delete(flightKey)
  }
}

export function downloadDisposalPhuLucII(catalogId: string): Promise<void> {
  return downloadDisposalAppendixExport(catalogId, 'phu-luc-ii')
}

export function downloadDisposalPhuLucIII(catalogId: string): Promise<void> {
  return downloadDisposalAppendixExport(catalogId, 'phu-luc-iii')
}
