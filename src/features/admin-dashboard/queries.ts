import { queryOptions } from '@tanstack/react-query'

import { getAdminDashboard } from './api/adminDashboardClient'
import type { AdminDashboardDossierTrendGranularityT } from './types'

export const adminDashboardQueryKey = ['admin', 'dashboard'] as const

export const adminDashboardQueryOptions = (
  dossierTrendGranularity: AdminDashboardDossierTrendGranularityT = 'month',
) =>
  queryOptions({
    queryKey: [...adminDashboardQueryKey, dossierTrendGranularity],
    queryFn: () => getAdminDashboard({ dossierTrendGranularity }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
