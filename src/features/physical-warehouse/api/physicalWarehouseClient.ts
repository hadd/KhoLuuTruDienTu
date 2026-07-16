import type {
  CreateItemPayloadT,
  PhysicalWarehouseItemT,
  PhysicalWarehouseStatsT,
  PhysicalWarehouseTreeNodeT,
  PhysicalWarehouseUploadImageResultT,
  UpdateItemPayloadT,
} from '@/features/physical-warehouse/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

export async function getPhysicalWarehouseItems(params?: {
  parentId?: string
  availableOnly?: boolean
}): Promise<Array<PhysicalWarehouseItemT>> {
  const searchParams = new URLSearchParams()
  if (params?.parentId) {
    searchParams.set('parentId', params.parentId)
  }
  if (params?.availableOnly) {
    searchParams.set('availableOnly', 'true')
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

export async function reparentPhysicalWarehouseItem(
  id: string,
  newParentId: string,
): Promise<PhysicalWarehouseItemT> {
  const response = await apiClient.post<{
    record: PhysicalWarehouseItemT
    status: string
  }>(`/api/v1/physical-warehouse/items/${id}/reparent`, { newParentId })
  return response.data.record
}

export async function deletePhysicalWarehouseItem(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/physical-warehouse/items/${id}`)
}

export async function uploadPhysicalWarehouseImage(
  file: File,
): Promise<PhysicalWarehouseUploadImageResultT> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.postForm<PhysicalWarehouseUploadImageResultT>(
    '/api/v1/physical-warehouse/upload-image',
    formData,
  )
  return response.data
}

export async function getPhysicalWarehouseItem(
  id: string,
): Promise<PhysicalWarehouseItemT> {
  const response = await apiClient.get<
    SingleResourceResponse<PhysicalWarehouseItemT>
  >(`/api/v1/physical-warehouse/items/${id}`)
  return response.data.record
}

export type PhysicalItemPlacementRowT = {
  id: string
  dossierId: string
  physicalItemId: string
  units: number
  status: string
  placedAt: string
  notes: string | null
  dossierName: string
  folderPath: string | null
  dossierStatus: string
}

export async function getPlacementsByPhysicalItem(
  physicalItemId: string,
): Promise<Array<PhysicalItemPlacementRowT>> {
  const response = await apiClient.get<{
    items: Array<PhysicalItemPlacementRowT>
  }>(
    `/api/v1/physical-warehouse/placements?physicalItemId=${encodeURIComponent(physicalItemId)}`,
  )
  return response.data.items
}

export type UnplacedWarehouseDossierT = {
  id: string
  name: string
  folderPath: string | null
  status: string
  updatedAt: string
}

export async function getUnplacedWarehouseDossiers(params?: {
  page?: number
  limit?: number
}): Promise<{
  items: Array<UnplacedWarehouseDossierT>
  total: number
  page: number
  limit: number
  totalPages: number
}> {
  const searchParams = new URLSearchParams()
  if (params?.page != null) searchParams.set('page', String(params.page))
  if (params?.limit != null) searchParams.set('limit', String(params.limit))
  const query = searchParams.toString()
  const response = await apiClient.get<{
    items: Array<UnplacedWarehouseDossierT>
    total: number
    page: number
    limit: number
    totalPages: number
  }>(
    `/api/v1/physical-warehouse/placements/unplaced${query ? `?${query}` : ''}`,
  )
  return response.data
}

export async function placeWarehouseDossier(payload: {
  dossierId: string
  physicalItemId: string
  notes?: string | null
}) {
  const response = await apiClient.post<{
    placement: PhysicalItemPlacementRowT
    breadcrumb: string | null
  }>('/api/v1/physical-warehouse/placements', payload)
  return response.data
}

export async function removeWarehouseDossierPlacement(payload: {
  dossierId: string
  notes?: string | null
}) {
  const response = await apiClient.post<{
    placement: PhysicalItemPlacementRowT
  }>('/api/v1/physical-warehouse/placements/remove', payload)
  return response.data
}
