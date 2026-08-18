// @/features/warehouse-dashboard/api/warehouseDashboardClient.ts

import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

// ==========================================
// 1. KIỂU DỮ LIỆU ĐẦU RA CHUẨN HÓA (NORMALIZED TYPES)
// ==========================================

export type WarehouseLocationT = {
  id: string
  parentId: string | null
  name: string
  imageUrl: string | null
  address: string | null
  capacity: number | null
  usedCapacity: number
  childCount: number
  remainingCapacity: number | null
}

export type ActiveFondT = {
  id: string
  name: string
  dossierCount: number
}

export type ActiveFondsResponseT = {
  items: ActiveFondT[]
  total: number
}

export type WarehouseDossierChartPointT = {
  period: string
  editedCompleted: number
  fullyCompleted: number
}

export type WarehouseDossierChartT = {
  granularity: 'day' | 'month' | 'year'
  rangeStart: string
  rangeEnd: string
  points: WarehouseDossierChartPointT[]
}

export type WarehouseStatsT = {
  totalDossiers: number
  byStatus: Record<string, number>
  dossierChart: WarehouseDossierChartT
}

// ==========================================
// 2. KIỂU DỮ LIỆU THÔ TỪ API (RAW TYPES)
// ==========================================

type WarehouseLocationRawT = {
  id?: string
  parentId?: string | null
  name?: string
  imageUrl?: string | null
  address?: string | null
  capacity?: number | null
  usedCapacity?: number
  childCount?: number
}

type ActiveFondRawT = {
  id?: string
  name?: string
  fondName?: string
  dossierCount?: number
  dossiersCount?: number
}

type ActiveFondsResponseRawT = {
  items?: ActiveFondRawT[]
  total?: number
}

type WarehouseDossierChartPointRawT = {
  period?: string
  editedCompleted?: number
  fullyCompleted?: number
}

type WarehouseDossierChartRawT = {
  granularity?: 'day' | 'month' | 'year'
  rangeStart?: string
  rangeEnd?: string
  points?: WarehouseDossierChartPointRawT[]
}

type WarehouseStatsRawT = {
  totalDossiers?: number
  byStatus?: Record<string, number>
  dossierChart?: WarehouseDossierChartRawT
}

// ==========================================
// 3. HÀM KIỂM TRA VÀ BÓC TÁCH KHUNG BAO (WRAPPER UNWRAPPERS)
// ==========================================

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

// ==========================================
// 4. HÀM CHUẨN HÓA DỮ LIỆU DỰ PHÒNG (NORMALIZERS)
// ==========================================

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
    name: raw.fondName ?? raw.name ?? '-',
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

function normalizeWarehouseDossierChartPoint(
  point: WarehouseDossierChartPointRawT,
): WarehouseDossierChartPointT {
  return {
    period: point.period ?? '',
    editedCompleted: point.editedCompleted ?? 0,
    fullyCompleted: point.fullyCompleted ?? 0,
  }
}

function normalizeWarehouseDossierChart(
  raw: WarehouseDossierChartRawT | undefined,
): WarehouseDossierChartT {
  return {
    granularity: raw?.granularity ?? 'month',
    rangeStart: raw?.rangeStart ?? '',
    rangeEnd: raw?.rangeEnd ?? '',
    points: (raw?.points ?? []).map(normalizeWarehouseDossierChartPoint),
  }
}

function normalizeWarehouseStats(raw: WarehouseStatsRawT): WarehouseStatsT {
  return {
    totalDossiers: raw.totalDossiers ?? 0,
    byStatus: raw.byStatus ?? {},
    dossierChart: normalizeWarehouseDossierChart(raw.dossierChart),
  }
}

// ==========================================
// 5. CÁC PHƯƠNG THỨC API KHAI THÁC CHÍNH (API CALLS)
// ==========================================

/**
 * Lấy danh sách địa điểm kho gốc kèm thống kê sức chứa thực tế đã chuẩn hóa
 */
export const getWarehouseDashboardLocations = async (): Promise<WarehouseLocationT[]> => {
  const response = await apiClient.get<
    WarehouseLocationRawT[] | SingleResourceResponse<WarehouseLocationRawT[]>
  >('/api/v1/dashboard/warehouse/locations')

  const rawData = unwrapResponse(response.data)
  return (Array.isArray(rawData) ? rawData : []).map(normalizeWarehouseLocation)
}

/**
 * Lấy danh sách phông lưu trữ kèm số lượng hồ sơ hoạt động đã chuẩn hóa
 */
export const getActiveFondsWithCount = async (): Promise<ActiveFondsResponseT> => {
  // Thay đổi đường dẫn gọi từ '/api/v1/fonds/active-with-count' sang API của Dashboard Warehouse:
  const response = await apiClient.get<
    ActiveFondsResponseRawT | SingleResourceResponse<ActiveFondsResponseRawT>
  >('/api/v1/dashboard/warehouse/active-fonds')

  const rawData = unwrapResponse(response.data)
  return normalizeActiveFondsResponse(rawData)
}

/**
 * Lấy dữ liệu thống kê tổng quan hồ sơ & biểu đồ tăng trưởng số hóa kho dành cho Thủ kho
 */
export const getWarehouseDashboardStats = async (params?: {
  chartGranularity?: 'day' | 'month'
}): Promise<WarehouseStatsT> => {
  const response = await apiClient.get<
    WarehouseStatsRawT | SingleResourceResponse<WarehouseStatsRawT>
  >('/api/v1/dashboard/warehouse/stats', {
    params: params?.chartGranularity
      ? { chartGranularity: params.chartGranularity }
      : undefined,
  })

  const rawData = unwrapResponse(response.data)
  return normalizeWarehouseStats(rawData)
}

/**
 * Lấy danh sách hồ sơ chưa phân vị trí trong kho vật lý dành riêng cho thủ kho
 */
export const getWarehouseDashboardUnplaced = async (): Promise<{ items: any[]; total: number }> => {
  const response = await apiClient.get('/api/v1/dashboard/warehouse/unplaced')
  return unwrapResponse(response.data)
}

/**
 * Lấy số liệu đếm phiếu mượn trả dành riêng cho thủ kho
 */
export const getWarehouseDashboardBorrowStats = async (): Promise<{
  pending: number
  approved: number
  returned: number
  rejected: number
  total: number
}> => {
  const response = await apiClient.get('/api/v1/dashboard/warehouse/borrow-stats')
  return unwrapResponse(response.data)
}

/**
 * Lấy danh sách hồ sơ chờ tiêu hủy dành riêng cho thủ kho
 */
export const getWarehouseDashboardDisposal = async (): Promise<{ items: any[]; total: number }> => {
  const response = await apiClient.get('/api/v1/dashboard/warehouse/disposal-candidates')
  return unwrapResponse(response.data)
}