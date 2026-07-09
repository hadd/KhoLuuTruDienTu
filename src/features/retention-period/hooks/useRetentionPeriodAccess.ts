import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import {
  canCreateRetentionPeriods,
  canDeleteRetentionPeriods,
  canUpdateRetentionPeriods,
  canViewRetentionPeriods,
} from '@/features/retention-period/lib/retentionPeriodAccess'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useRetentionPeriodAccess() {
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
      canViewRetentionPeriods: canViewRetentionPeriods(permissions),
      canCreateRetentionPeriods: canCreateRetentionPeriods(permissions),
      canUpdateRetentionPeriods: canUpdateRetentionPeriods(permissions),
      canDeleteRetentionPeriods: canDeleteRetentionPeriods(permissions),
    }
  }, [user, rolePermissions])
}
