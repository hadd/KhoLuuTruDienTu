import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import {
  canCreateGroup,
  canDeleteGroup,
  canManageGroupMembers,
  canReadAllGroups,
  canStartGroupWorkflow,
  canUpdateGroup,
  canViewGroups,
} from '@/features/group/lib/groupAccess'

export function useGroupAccess() {
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
      canViewGroups: canViewGroups(permissions),
      canReadAllGroups: canReadAllGroups(permissions),
      canCreateGroup: canCreateGroup(permissions),
      canUpdateGroup: canUpdateGroup(permissions),
      canDeleteGroup: canDeleteGroup(permissions),
      canManageGroupMembers: canManageGroupMembers(permissions),
      canStartGroupWorkflow: canStartGroupWorkflow(permissions),
    }
  }, [user, rolePermissions])
}
