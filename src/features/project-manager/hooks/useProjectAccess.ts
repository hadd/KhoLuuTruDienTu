import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  getPrimaryAppRoleFromProfile,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import {
  canCreateProjects,
  canDeleteProjects,
  canUpdateProjects,
  canViewProjects,
  hasGlobalProjectScope,
} from '@/features/project-manager/lib/projectAccess'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useProjectAccess() {
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

    return {
      permissions,
      primaryAppRole,
      canViewAllProjects: hasGlobalProjectScope(permissions, primaryAppRole),
      canViewProjects: canViewProjects(permissions),
      canCreateProjects: canCreateProjects(permissions),
      canUpdateProjects: canUpdateProjects(permissions),
      canDeleteProjects: canDeleteProjects(permissions),
      canChangeProjectManager: hasGlobalProjectScope(permissions, primaryAppRole),
    }
  }, [user, rolePermissions])
}
