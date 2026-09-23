import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import {
  getAdminDashboard,
  getAdminDossierChart,
  getAdminEmployeeKpis,
} from './api/adminDashboardClient'
import type { AdminDashboardDossierTrendGranularityT } from './types'

export const adminDashboardQueryKey = ['admin', 'dashboard'] as const

export const adminDashboardOverviewQueryOptions = () =>
  queryOptions({
    queryKey: [...adminDashboardQueryKey, 'overview'],
    queryFn: () => getAdminDashboard(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

/** @deprecated Use adminDashboardOverviewQueryOptions */
export const adminDashboardQueryOptions = adminDashboardOverviewQueryOptions

export const adminEmployeeKpisQueryOptions = (
  dateFrom?: string,
  dateTo?: string,
) =>
  queryOptions({
    queryKey: [...adminDashboardQueryKey, 'employee-kpis', dateFrom, dateTo],
    queryFn: () => getAdminEmployeeKpis({ dateFrom, dateTo }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

export const adminDossierChartQueryOptions = (
  dossierTrendGranularity: AdminDashboardDossierTrendGranularityT = 'month',
  dateFrom?: string,
  dateTo?: string,
) =>
  queryOptions({
    queryKey: [
      ...adminDashboardQueryKey,
      'dossier-chart',
      dossierTrendGranularity,
      dateFrom,
      dateTo,
    ],
    queryFn: () =>
      getAdminDossierChart({
        dossierTrendGranularity,
        dateFrom,
        dateTo,
      }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
