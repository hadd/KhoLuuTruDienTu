import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getPrimaryAppRoleFromProfile,
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { canAccessDossierManagementScreen } from '@/features/data-management/lib/resolveDataManagementRole'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useDraftDossiersAccess() {
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
      canViewDraftDossiers: canAccessDossierManagementScreen(
        permissions,
        primaryAppRole,
      ),
    }
  }, [user, rolePermissions])
}
