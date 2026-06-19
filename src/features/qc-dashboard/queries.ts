import { queryOptions } from '@tanstack/react-query'

import {
  getQcDashboard,
  getQcDashboardGroup,
} from './api/qcDashboardClient'
import { isQcGroupLeaderOnlyError } from './lib/loadErrors'

export const qcDashboardQueryKey = ['qc', 'dashboard'] as const
export const qcDashboardGroupQueryKey = ['qc', 'dashboard', 'group'] as const

export const qcDashboardQueryOptions = () =>
  queryOptions({
    queryKey: qcDashboardQueryKey,
    queryFn: getQcDashboard,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

export const qcDashboardGroupQueryOptions = () =>
  queryOptions({
    queryKey: qcDashboardGroupQueryKey,
    queryFn: getQcDashboardGroup,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: (failureCount, error) =>
      !isQcGroupLeaderOnlyError(error) && failureCount < 1,
  })
