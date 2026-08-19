// @/features/warehouse-dashboard/api/warehouseDashboardClient.ts

import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'
import type { WarehouseLocationT
  , ActiveFondT
  , ActiveFondsResponseT
  , WarehouseLocationRawT
  , ActiveFondRawT
  , ActiveFondsResponseRawT
  , WarehouseStatsT } from '../types'

// --- HÀM TRỢ GIÚP CHUẨN HÓA (UTILITIES & NORMALIZERS) ---

function isRecordWrapper<T>(
  data: T | SingleResourceResponse<T>,
): data is SingleResourceResponse<T> {
  return typeof data === 'object' && data !== null && 'record' in data
}

function unwrapResponse<T>(
  data: T | SingleResourceResponse<T>,
): T {
  if (isRecordWrapper(data)) {
    return data.record
  }
  return data
}

function normalizeWarehouseLocation(
  raw: WarehouseLocationRawT,
): WarehouseLocationT {
  const capacity = raw.capacity !== undefined && raw.capacity !== null ? Number(raw.capacity) : null
  const usedCapacity = raw.usedCapacity !== undefined && raw.usedCapacity !== null ? Number(raw.usedCapacity) : 0

  return {
    id: raw.id ?? '',
    parentId: raw.parentId ?? null,
    name: raw.name ?? '-',
    imageUrl: raw.imageUrl ?? null,
    address: raw.address ?? null,
    capacity,
    usedCapacity,
    childCount: raw.childCount ?? 0,
    remainingCapacity: capacity !== null ? Math.max(0, capacity - usedCapacity) : null,
  }
}

function normalizeActiveFond(raw: ActiveFondRawT): ActiveFondT {
  return {
    id: raw.id ?? '',
    name: raw.fondName ?? '-',
    dossierCount: raw.dossierCount ?? raw.dossiersCount ?? 0,
  }
}

function normalizeActiveFondsResponse(
  raw: ActiveFondsResponseRawT,
): ActiveFondsResponseT {
  const items = (raw.items ?? []).map(normalizeActiveFond)
  return {
    items,
    total: raw.total ?? items.length,
  }
}

// --- CÁC HÀM GỌI API (API CALLS) ---

/**
 * Lấy danh sách địa điểm kho gốc kèm thống kê sức chứa thực tế
 */
export const getWarehouseDashboardLocations = async (): Promise<WarehouseLocationT[]> => {
  const response = await apiClient.get<
    WarehouseLocationRawT[] | SingleResourceResponse<WarehouseLocationRawT[]>
  >('/api/v1/dashboard/warehouse/locations')

  const rawData = unwrapResponse(response.data)
  return (Array.isArray(rawData) ? rawData : []).map(normalizeWarehouseLocation)
}

/**
 * Lấy danh sách phông lưu trữ kèm số lượng hồ sơ đang hoạt động
 */
export const getActiveFondsWithCount = async (): Promise<ActiveFondsResponseT> => {
  const response = await apiClient.get<
    ActiveFondsResponseRawT | SingleResourceResponse<ActiveFondsResponseRawT>
  >('/api/v1/fonds/active-with-count')

  const rawData = unwrapResponse(response.data)
  return normalizeActiveFondsResponse(rawData)
}

/**
 * Lấy số liệu thống kê hồ sơ và biểu đồ tăng trưởng số hóa nạp kho
 */
export const getWarehouseStats = async (
  granularity: 'day' | 'month' = 'month'
): Promise<WarehouseStatsT> => {
  const response = await apiClient.get<
    WarehouseStatsT | SingleResourceResponse<WarehouseStatsT>
  >('/api/v1/dashboard/warehouse/stats', {
    params: { chartGranularity: granularity },
  })

  return unwrapResponse(response.data)
}