import { queryOptions } from '@tanstack/react-query'

import { getRoles } from './api/roleClient'
import {
  getAllUsers,
  getUsersByRole,
  type GetAllUsersParamsT,
} from './api/userClient'

export const ADMIN_USERS_PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 30, 50] as const
export const DEFAULT_ADMIN_USERS_LIMIT = 10

export const adminUsersQueryKeyPrefix = ['admin', 'users'] as const

export const adminUsersQueryKey = (params?: GetAllUsersParamsT) =>
  [...adminUsersQueryKeyPrefix, params ?? {}] as const
export const adminRolesQueryKey = ['admin', 'roles'] as const
export const adminUsersByRoleQueryKey = (roleId: string) =>
  ['admin', 'users', 'by-role', roleId] as const

export const adminUsersQueryOptions = (params?: GetAllUsersParamsT) =>
  queryOptions({
    queryKey: adminUsersQueryKey(params),
    queryFn: () =>
      getAllUsers({
        page: params?.page ?? 1,
        limit: params?.limit ?? DEFAULT_ADMIN_USERS_LIMIT,
      }),
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
