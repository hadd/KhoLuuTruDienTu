import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import {
  canCreateFonds,
  canDeleteFonds,
  canUpdateFonds,
  canViewFonds,
} from '@/features/archive-fond/lib/fondAccess'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useFondAccess() {
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

    return {
      permissions,
      canViewFonds: canViewFonds(permissions),
      canCreateFonds: canCreateFonds(permissions),
      canUpdateFonds: canUpdateFonds(permissions),
      canDeleteFonds: canDeleteFonds(permissions),
    }
  }, [user, rolePermissions])
}
