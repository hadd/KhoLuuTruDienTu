import type {
  CreateInventoryPayloadT,
  GetInventoriesParamsT,
  InventoryT,
  UpdateInventoryPayloadT,
} from '@/features/inventory/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'

export async function getInventories(
  params?: GetInventoriesParamsT,
): Promise<PaginatedResponse<InventoryT>> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
    search: params?.search,
  })

  const queryString = searchParams.toString()
  const url = `/api/v1/inventories${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<PaginatedResponse<InventoryT>>(url)
  return response.data
}

export async function createInventoryRecord(
  payload: CreateInventoryPayloadT,
): Promise<InventoryT> {
  const response = await apiClient.post<SingleResourceResponse<InventoryT>>(
    '/api/v1/inventories',
    payload,
  )
  return response.data.record
}

export async function updateInventoryRecord(
  id: string,
  payload: UpdateInventoryPayloadT,
): Promise<InventoryT> {
  const response = await apiClient.put<SingleResourceResponse<InventoryT>>(
    `/api/v1/inventories/${encodeURIComponent(id)}`,
    payload,
  )
  return response.data.record
}

export async function deleteInventoryRecord(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/inventories/${encodeURIComponent(id)}`)
}

export async function getActiveInventories(): Promise<{
  items: Array<InventoryT>
}> {
  const response = await apiClient.get<{ items: Array<InventoryT> }>(
    '/api/v1/inventories/active',
  )
  return response.data
}
