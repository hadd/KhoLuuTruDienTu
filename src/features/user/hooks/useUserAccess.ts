import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import {
  canCreateUsers,
  canDeleteUsers,
  canExportUsers,
  canImportUsers,
  canResetUserPassword,
  canUpdateUsers,
  canViewUsers,
} from '@/features/user/lib/userAccess'

export function useUserAccess() {
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
      canViewUsers: canViewUsers(permissions),
      canCreateUsers: canCreateUsers(permissions),
      canUpdateUsers: canUpdateUsers(permissions),
      canDeleteUsers: canDeleteUsers(permissions),
      canImportUsers: canImportUsers(permissions),
      canExportUsers: canExportUsers(permissions),
      canResetUserPassword: canResetUserPassword(permissions),
    }
  }, [user, rolePermissions])
}
