import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { getPersonalDailyKpis } from './api/personalKpiClient'

export const personalDailyKpisQueryKey = ['dashboard', 'personal-kpis'] as const

export const personalDailyKpisQueryOptions = (
  dateFrom?: string,
  dateTo?: string,
) =>
  queryOptions({
    queryKey: [...personalDailyKpisQueryKey, dateFrom ?? '', dateTo ?? ''] as const,
    queryFn: () => getPersonalDailyKpis(dateFrom, dateTo),
    staleTime: 60_000,
    refetchInterval: 120_000,
    placeholderData: keepPreviousData,
  })
