import type {
  ArchiveWarehouseDossierDetailT,
  ArchiveWarehouseDossiersResponseT,
  ArchiveWarehouseFondSummaryT,
  GetArchiveWarehouseDossiersParamsT,
  GetArchiveWarehouseFondSummaryParamsT,
  WarehouseDossierStatusT,
} from '@/features/archive-warehouse/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'

export async function getArchiveWarehouseFondSummary(
  params: GetArchiveWarehouseFondSummaryParamsT,
): Promise<ArchiveWarehouseFondSummaryT> {
  const searchParams = new URLSearchParams()
  if (params.status) {
    searchParams.set('status', params.status)
  }
  const queryString = searchParams.toString()
  const response = await apiClient.get<ArchiveWarehouseFondSummaryT>(
    `/api/v1/archive-warehouse/fonds/${encodeURIComponent(params.fondId)}/summary${queryString ? `?${queryString}` : ''}`,
  )
  return response.data
}

export async function getArchiveWarehouseDossiers(
  params: GetArchiveWarehouseDossiersParamsT,
): Promise<ArchiveWarehouseDossiersResponseT> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    search: params.search,
  })
  searchParams.set('fondId', params.fondId)
  if (params.year != null) {
    searchParams.set('year', String(params.year))
  }
  if (params.status) {
    searchParams.set('status', params.status)
  }

  const queryString = searchParams.toString()
  const response = await apiClient.get<ArchiveWarehouseDossiersResponseT>(
    `/api/v1/archive-warehouse/dossiers?${queryString}`,
  )
  const data = response.data

  return {
    items: data.items ?? [],
    page: data.page ?? params.page ?? 1,
    limit: data.limit ?? params.limit ?? 20,
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
    fondScope: data.fondScope ?? null,
    fondId: data.fondId ?? params.fondId,
  }
}

export async function getArchiveWarehouseDossierDetail(
  dossierId: string,
): Promise<ArchiveWarehouseDossierDetailT> {
  const response = await apiClient.get<ArchiveWarehouseDossierDetailT>(
    `/api/v1/archive-warehouse/dossiers/${dossierId}`,
  )
  return response.data
}

export const WAREHOUSE_DOSSIER_STATUSES = ['ARCHIVED'] as const satisfies Array<
  WarehouseDossierStatusT
>
