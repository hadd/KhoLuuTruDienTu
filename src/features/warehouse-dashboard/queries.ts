// @/features/warehouse-dashboard/queries.ts

import { queryOptions } from '@tanstack/react-query'
import {
  getWarehouseDashboardLocations,
  getActiveFondsWithCount,
  getWarehouseDashboardStats,
  getWarehouseDashboardUnplaced,
  getWarehouseDashboardBorrowStats,
  getWarehouseDashboardDisposal
} from './api/warehouseDashboardClient'

export const warehouseDashboardQueries = {
    // 1. Chỉ số tổng quan & Biểu đồ nạp kho
    adminDashboard: (granularity: 'day' | 'month') => ({
        queryKey: ['warehouse-dashboard', 'stats', granularity],
        queryFn: () => getWarehouseDashboardStats({ chartGranularity: granularity }),
        staleTime: 30_000,
    }),

    // 2. Danh sách kho vật lý & sức chứa
    rootLocations: () => ({
        queryKey: ['warehouse-dashboard', 'root-locations'], 
        queryFn: () => getWarehouseDashboardLocations(),
        staleTime: 30_000,
    }),

    // 3. Hồ sơ chưa phân vị trí
    unplacedDossiers: () => ({
        queryKey: ['warehouse-dashboard', 'placements', 'unplaced'],
        queryFn: () => getWarehouseDashboardUnplaced(),
        staleTime: 15_000,
    }),

    // 4. Thống kê số lượng mượn trả
    borrowRequests: () => ({
        queryKey: ['warehouse-dashboard', 'borrow-stats'],
        queryFn: () => getWarehouseDashboardBorrowStats(),
        staleTime: 30_000,
    }),

    // 5. Phân bổ hồ sơ theo phông lưu trữ
    activeFonds: () => ({
        queryKey: ['warehouse-dashboard', 'active-fonds'],
        queryFn: () => getActiveFondsWithCount(),
        staleTime: 30_000,
    }),

    // 6. Danh mục hồ sơ chờ tiêu hủy
    disposalCandidates: () => ({
        queryKey: ['warehouse-dashboard', 'disposal-candidates'],
        queryFn: () => getWarehouseDashboardDisposal(),
        staleTime: 30_000,
    }),
}