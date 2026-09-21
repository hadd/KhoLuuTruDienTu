import { queryOptions } from '@tanstack/react-query'

import { getAdminDashboard } from './api/adminDashboardClient'
import type { AdminDashboardDossierTrendGranularityT } from './types'

export const adminDashboardQueryKey = ['admin', 'dashboard'] as const

export const adminDashboardQueryOptions = (
  dossierTrendGranularity: AdminDashboardDossierTrendGranularityT = 'month',
  dateFrom?: string,
  dateTo?: string,
) =>
  queryOptions({
    queryKey: [...adminDashboardQueryKey, dossierTrendGranularity, dateFrom, dateTo],
    queryFn: () => getAdminDashboard({ dossierTrendGranularity, dateFrom, dateTo }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
