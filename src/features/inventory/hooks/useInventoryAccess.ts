import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import {
  canCreateInventories,
  canDeleteInventories,
  canUpdateInventories,
  canViewInventories,
} from '@/features/inventory/lib/inventoryAccess'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useInventoryAccess() {
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
      canViewInventories: canViewInventories(permissions),
      canCreateInventories: canCreateInventories(permissions),
      canUpdateInventories: canUpdateInventories(permissions),
      canDeleteInventories: canDeleteInventories(permissions),
    }
  }, [user, rolePermissions])
}
