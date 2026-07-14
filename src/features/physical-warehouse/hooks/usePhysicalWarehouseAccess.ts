import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import {
  canManagePhysicalWarehouseConfig,
  canManagePhysicalWarehouseItems,
  canViewPhysicalWarehouse,
} from '@/features/physical-warehouse/lib/physicalWarehouseAccess'

export function usePhysicalWarehouseAccess() {
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
      canViewPhysicalWarehouse: canViewPhysicalWarehouse(permissions),
      canManageItems: canManagePhysicalWarehouseItems(permissions),
      canManageConfig: canManagePhysicalWarehouseConfig(permissions),
    }
  }, [user, rolePermissions])
}
