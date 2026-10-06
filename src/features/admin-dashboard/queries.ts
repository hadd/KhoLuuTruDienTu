import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import {
  getAdminDashboard,
  getAdminDossierChart,
  getAdminEmployeeKpis,
} from './api/adminDashboardClient'
import type { AdminDashboardDossierTrendGranularityT } from './types'

export const adminDashboardQueryKey = ['admin', 'dashboard'] as const

export const adminDashboardOverviewQueryOptions = (
  dateFrom?: string,
  dateTo?: string,
  projectCode?: string,
) =>
  queryOptions({
    queryKey: [...adminDashboardQueryKey, 'overview', dateFrom, dateTo, projectCode ?? ''],
    queryFn: () => getAdminDashboard({ dateFrom, dateTo, projectCode }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

/** @deprecated Use adminDashboardOverviewQueryOptions */
export const adminDashboardQueryOptions = adminDashboardOverviewQueryOptions

export const adminEmployeeKpisQueryOptions = (
  dateFrom?: string,
  dateTo?: string,
  projectCode?: string,
) =>
  queryOptions({
    queryKey: [...adminDashboardQueryKey, 'employee-kpis', dateFrom, dateTo, projectCode ?? ''],
    queryFn: () => getAdminEmployeeKpis({ dateFrom, dateTo, projectCode }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

export const adminDossierChartQueryOptions = (
  dossierTrendGranularity: AdminDashboardDossierTrendGranularityT = 'month',
  dateFrom?: string,
  dateTo?: string,
  projectCode?: string,
) =>
  queryOptions({
    queryKey: [
      ...adminDashboardQueryKey,
      'dossier-chart',
      dossierTrendGranularity,
      dateFrom,
      dateTo,
      projectCode ?? '',
    ],
    queryFn: () =>
      getAdminDossierChart({
        dossierTrendGranularity,
        dateFrom,
        dateTo,
        projectCode,
      }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
