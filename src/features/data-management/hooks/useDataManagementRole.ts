import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  getPrimaryAppRoleFromProfile,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { resolveDataManagementRole } from '@/features/data-management/lib/resolveDataManagementRole'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useDataManagementRole(): DataManagementRole {
  const { data: user } = useQuery(profileQueryOptions)
  const roleId = getCurrentUserRoleId(user)
  const { data: rolePermissions } = useQuery({
    ...rolePermissionsQueryOptions(roleId ?? ''),
    enabled: Boolean(roleId),
  })

  return useMemo(() => {
    const permissions = resolvePermissionsForUser(
      user,
      rolePermissions?.rules.permissions,
    )
    const primaryAppRole = getPrimaryAppRoleFromProfile(user)
    return resolveDataManagementRole(permissions, primaryAppRole)
  }, [user, rolePermissions])
}
