import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import {
  canCreateProjectPlans,
  canDeleteProjectPlans,
  canUpdateProjectPlans,
  canViewProjectPlans,
} from '@/features/plan-management/lib/planAccess'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function usePlanAccess() {
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
      canViewProjectPlans: canViewProjectPlans(permissions),
      canCreateProjectPlans: canCreateProjectPlans(permissions),
      canUpdateProjectPlans: canUpdateProjectPlans(permissions),
      canDeleteProjectPlans: canDeleteProjectPlans(permissions),
    }
  }, [user, rolePermissions])
}
