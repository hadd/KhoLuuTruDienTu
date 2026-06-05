import { queryOptions } from '@tanstack/react-query'

import { getRoles } from './api/roleClient'
import { getAllUsers, getUsersByRole } from './api/userClient'

export const adminUsersQueryKey = ['admin', 'users'] as const
export const adminRolesQueryKey = ['admin', 'roles'] as const
export const adminUsersByRoleQueryKey = (roleId: string) =>
  ['admin', 'users', 'by-role', roleId] as const

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

export const adminUsersByRoleQueryOptions = (roleId: string) =>
  queryOptions({
    queryKey: adminUsersByRoleQueryKey(roleId),
    queryFn: () => getUsersByRole(roleId),
    staleTime: 60_000,
  })
