import type {
  CreateItemPayloadT,
  PhysicalWarehouseItemT,
  PhysicalWarehouseLevelT,
  PhysicalWarehouseStatsT,
  PhysicalWarehouseTreeNodeT,
  ReplaceLevelsPayloadT,
  UpdateItemPayloadT,
} from '@/features/physical-warehouse/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

export async function getPhysicalWarehouseLevels(): Promise<
  Array<PhysicalWarehouseLevelT>
> {
  const response = await apiClient.get<{ levels: Array<PhysicalWarehouseLevelT> }>(
    '/api/v1/physical-warehouse/levels',
  )
  return response.data.levels
}

export async function replacePhysicalWarehouseLevels(
  payload: ReplaceLevelsPayloadT,
): Promise<Array<PhysicalWarehouseLevelT>> {
  const response = await apiClient.put<{ levels: Array<PhysicalWarehouseLevelT> }>(
    '/api/v1/physical-warehouse/levels',
    payload,
  )
  return response.data.levels
}

export async function getPhysicalWarehouseItems(params?: {
  parentId?: string
}): Promise<Array<PhysicalWarehouseItemT>> {
  const searchParams = new URLSearchParams()
  if (params?.parentId) {
    searchParams.set('parentId', params.parentId)
  }
  const query = searchParams.toString()
  const response = await apiClient.get<{ items: Array<PhysicalWarehouseItemT> }>(
    `/api/v1/physical-warehouse/items${query ? `?${query}` : ''}`,
  )
  return response.data.items
}

export async function getPhysicalWarehouseTree(
  rootId: string,
): Promise<PhysicalWarehouseTreeNodeT | null> {
  const response = await apiClient.get<{
    tree: PhysicalWarehouseTreeNodeT | null
  }>(`/api/v1/physical-warehouse/items/tree?rootId=${encodeURIComponent(rootId)}`)
  return response.data.tree
}

export async function getPhysicalWarehouseStats(
  rootId: string,
): Promise<PhysicalWarehouseStatsT> {
  const response = await apiClient.get<{ stats: PhysicalWarehouseStatsT }>(
    `/api/v1/physical-warehouse/items/stats?rootId=${encodeURIComponent(rootId)}`,
  )
  return response.data.stats
}

export async function createPhysicalWarehouseItem(
  payload: CreateItemPayloadT,
): Promise<PhysicalWarehouseItemT> {
  const response = await apiClient.post<{
    record: PhysicalWarehouseItemT
    status: string
  }>('/api/v1/physical-warehouse/items', payload)
  return response.data.record
}

export async function updatePhysicalWarehouseItem(
  id: string,
  payload: UpdateItemPayloadT,
): Promise<PhysicalWarehouseItemT> {
  const response = await apiClient.put<{
    record: PhysicalWarehouseItemT
    status: string
  }>(`/api/v1/physical-warehouse/items/${id}`, payload)
  return response.data.record
}

export async function deletePhysicalWarehouseItem(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/physical-warehouse/items/${id}`)
}

export async function getPhysicalWarehouseItem(
  id: string,
): Promise<PhysicalWarehouseItemT> {
  const response = await apiClient.get<
    SingleResourceResponse<PhysicalWarehouseItemT>
  >(`/api/v1/physical-warehouse/items/${id}`)
  return response.data.record
}
