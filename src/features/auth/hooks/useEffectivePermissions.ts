import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getPermissionsFromUser,
  getUserRoleIdsFromProfile,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function mergePermissionLists(
  ...permissionLists: Array<Array<string> | null | undefined>
): Array<string> {
  const merged = new Set<string>()

  for (const permissions of permissionLists) {
    if (!permissions?.length) {
      continue
    }
    for (const permission of permissions) {
      merged.add(permission)
    }
  }

  return [...merged]
}

export function useEffectivePermissions() {
  const { data: user } = useQuery(profileQueryOptions)
  const roleIds = useMemo(() => getUserRoleIdsFromProfile(user), [user])
  const rolePermissionQueries = useQueries({
    queries: roleIds.map((roleId) => ({
      ...rolePermissionsQueryOptions(roleId),
      enabled: Boolean(roleId),
    })),
  })

  return useMemo(() => {
    const fromProfile = getPermissionsFromUser(user)
    const fromRoles = rolePermissionQueries.flatMap(
      (query) => query.data?.rules.permissions ?? [],
    )

    return mergePermissionLists(fromProfile, fromRoles)
  }, [user, rolePermissionQueries])
}
