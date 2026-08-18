// @/features/warehouse-dashboard/queries.ts

import { queryOptions } from '@tanstack/react-query'
import { adminDashboardQueryOptions } from '@/features/admin-dashboard/queries'
import { getDisposalCandidates } from '@/features/archive-disposal/api/archiveDisposalClient'
import { getReviewArchiveBorrowRequests } from '@/features/archive-borrow/api/archiveBorrowClient'
import { getUnplacedWarehouseDossiers } from '@/features/physical-warehouse/api/physicalWarehouseClient'

import { 
  getWarehouseDashboardLocations, 
  getActiveFondsWithCount 
} from './api/warehouseDashboardClient'

export const warehouseDashboardQueries = {
    adminDashboard: (granularity: 'day' | 'month') => adminDashboardQueryOptions(granularity),

    // Thay đổi Query Key ở đây để tách biệt hoàn toàn bộ nhớ đệm
    rootLocations: () => ({
        queryKey: ['warehouse-dashboard', 'root-locations'], 
        queryFn: () => getWarehouseDashboardLocations(),
        staleTime: 30_000,
    }),

    unplacedDossiers: () => ({
        queryKey: ['warehouse-dashboard', 'placements', 'unplaced'], // Có thể tách biệt luôn key này nếu cần
        queryFn: () => getUnplacedWarehouseDossiers({ limit: 5 }),
        staleTime: 15_000,
    }),

    borrowRequests: () => ({
        queryKey: ['archive-borrow', 'review-list'],
        queryFn: () => getReviewArchiveBorrowRequests({ limit: 100 }),
        staleTime: 30_000,
    }),

    activeFonds: () => ({
        queryKey: ['archive-fond', 'active-with-count'],
        queryFn: () => getActiveFondsWithCount(),
        staleTime: 30_000,
    }),

    disposalCandidates: () => ({
        queryKey: ['archive-disposal', 'candidates'],
        queryFn: () => getDisposalCandidates({ limit: 5 }),
        staleTime: 30_000,
    }),
}