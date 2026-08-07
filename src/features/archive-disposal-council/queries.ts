import { queryOptions } from '@tanstack/react-query'

import {
  getAvailableCatalogsForCouncil,
  getDisposalCouncil,
  getDisposalCouncilEvaluations,
  getDisposalCouncilHistory,
  getDisposalCouncils,
  getDisposalSettings,
} from '@/features/archive-disposal-council/api/disposalCouncilClient'
import { getDisposalCouncilEligibleUsers } from '@/features/archive-disposal-council/lib/disposalCouncilEligibleUsers'

export const disposalCouncilEligibleUsersQueryKey = [
  'archive-disposal',
  'council-eligible-users',
] as const

export const disposalCouncilEligibleUsersQueryOptions = () =>
  queryOptions({
    queryKey: disposalCouncilEligibleUsersQueryKey,
    queryFn: getDisposalCouncilEligibleUsers,
    staleTime: 60_000,
  })

export const disposalSettingsQueryKey = ['archive-disposal', 'settings'] as const

export const disposalSettingsQueryOptions = () =>
  queryOptions({
    queryKey: disposalSettingsQueryKey,
    queryFn: getDisposalSettings,
    staleTime: 30_000,
  })

export const disposalCouncilsQueryKeyPrefix = ['archive-disposal', 'councils'] as const

export const disposalCouncilsQueryOptions = (params?: {
  page?: number
  limit?: number
  catalogId?: string
}) =>
  queryOptions({
    queryKey: [...disposalCouncilsQueryKeyPrefix, params ?? {}],
    queryFn: () => getDisposalCouncils(params),
    staleTime: 30_000,
  })

export const disposalCouncilDetailQueryOptions = (councilId: string | null) =>
  queryOptions({
    queryKey: ['archive-disposal', 'council', councilId],
    queryFn: () => getDisposalCouncil(councilId!),
    enabled: Boolean(councilId),
    staleTime: 15_000,
  })

export const disposalCouncilHistoryQueryOptions = (councilId: string | null) =>
  queryOptions({
    queryKey: ['archive-disposal', 'council-history', councilId],
    queryFn: () => getDisposalCouncilHistory(councilId!),
    enabled: Boolean(councilId),
    staleTime: 15_000,
  })

export const disposalCouncilEvaluationsQueryOptions = (councilId: string | null) =>
  queryOptions({
    queryKey: ['archive-disposal', 'council-evaluations', councilId],
    queryFn: () => getDisposalCouncilEvaluations(councilId!),
    enabled: Boolean(councilId),
    staleTime: 10_000,
  })

export const availableCatalogsForCouncilQueryOptions = () =>
  queryOptions({
    queryKey: ['archive-disposal', 'available-catalogs-for-council'],
    queryFn: getAvailableCatalogsForCouncil,
    staleTime: 30_000,
  })
