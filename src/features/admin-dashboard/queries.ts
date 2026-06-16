import { queryOptions } from '@tanstack/react-query'

import { getAdminDashboard } from './api/adminDashboardClient'

export const adminDashboardQueryKey = ['admin', 'dashboard'] as const

export const adminDashboardQueryOptions = () =>
  queryOptions({
    queryKey: adminDashboardQueryKey,
    queryFn: getAdminDashboard,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
