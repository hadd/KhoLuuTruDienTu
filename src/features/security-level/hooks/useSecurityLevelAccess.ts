import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import {
  canConfigSecurityLevels,
  canCreateSecurityLevels,
  canDeleteSecurityLevels,
  canManageSecurityPermissionDefs,
  canUpdateSecurityLevels,
  canViewSecurityLevels,
  canViewSecurityPermissionDefs,
} from '@/features/security-level/lib/securityLevelAccess'

export function useSecurityLevelAccess() {
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
      canViewSecurityLevels: canViewSecurityLevels(permissions),
      canCreateSecurityLevels: canCreateSecurityLevels(permissions),
      canUpdateSecurityLevels: canUpdateSecurityLevels(permissions),
      canDeleteSecurityLevels: canDeleteSecurityLevels(permissions),
      canConfigSecurityLevels: canConfigSecurityLevels(permissions),
      canViewSecurityPermissionDefs: canViewSecurityPermissionDefs(permissions),
      canManageSecurityPermissionDefs:
        canManageSecurityPermissionDefs(permissions),
    }
  }, [user, rolePermissions])
}
