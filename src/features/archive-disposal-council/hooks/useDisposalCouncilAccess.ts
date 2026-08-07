import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  hasDisposalCouncilCreatePermission,
  hasDisposalCouncilReadPermission,
  hasDisposalCouncilUpdatePermission,
  hasDisposalCouncilFinalizePermission,
  hasDisposalDestroyPermission,
  hasDisposalSettingsReadPermission,
  hasDisposalSettingsUpdatePermission,
} from '@/features/archive-disposal-council/lib/disposalCouncilAccess'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useDisposalCouncilAccess() {
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
      canReadCouncil: hasDisposalCouncilReadPermission(permissions),
      canCreateCouncil: hasDisposalCouncilCreatePermission(permissions),
      canUpdateCouncil: hasDisposalCouncilUpdatePermission(permissions),
      canFinalizeCouncil: hasDisposalCouncilFinalizePermission(permissions),
      canReadDisposalSettings: hasDisposalSettingsReadPermission(permissions),
      canUpdateDisposalSettings: hasDisposalSettingsUpdatePermission(permissions),
      canDestroyDisposal: hasDisposalDestroyPermission(permissions),
    }
  }, [user, rolePermissions])
}
