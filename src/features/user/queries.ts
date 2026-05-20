import { queryOptions } from '@tanstack/react-query'

import { getRoles } from './api/roleClient'
import { getAllUsers } from './api/userClient'

export const adminUsersQueryKey = ['admin', 'users'] as const
export const adminRolesQueryKey = ['admin', 'roles'] as const

export const adminUsersQueryOptions = () =>
  queryOptions({
    queryKey: adminUsersQueryKey,
    queryFn: getAllUsers,
    staleTime: 60_000,
  })

export const adminRolesQueryOptions = () =>
  queryOptions({
    queryKey: adminRolesQueryKey,
    queryFn: getRoles,
    staleTime: 300_000,
  })
