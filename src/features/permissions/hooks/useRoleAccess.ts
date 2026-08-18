import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { canManageRoles } from '@/features/permissions/lib/roleAccess'
import { hasFullAccess } from '@/features/permissions/lib/permissionRules'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useRoleAccess() {
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

    const isAdmin = Boolean(
      user?.userRoles?.some((ur) => ur.role?.id === 'admin') ||
        hasFullAccess(permissions),
    )

    return {
      permissions,
      canManageRoles: canManageRoles(permissions),
      isAdmin,
    }
  }, [user, rolePermissions])
}
