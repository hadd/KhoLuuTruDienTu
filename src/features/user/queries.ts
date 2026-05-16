import { queryOptions } from '@tanstack/react-query'

import { getAllUsers } from './api/userClient'

export const adminUsersQueryKey = ['admin', 'users'] as const

export const adminUsersQueryOptions = () =>
  queryOptions({
    queryKey: adminUsersQueryKey,
    queryFn: getAllUsers,
    staleTime: 60_000,
  })
