import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  getPermissionsFromUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import {
  canManagePhysicalWarehouseContents,
  canManagePhysicalWarehouseItems,
  canManagePhysicalWarehouseLocations,
  canManagePhysicalWarehouses,
  canViewPhysicalWarehouse,
} from '@/features/physical-warehouse/lib/physicalWarehouseAccess'

function resolveEffectivePermissions(
  roleId: string | null,
  rolePermissions: Array<string> | undefined,
  isRolePermissionsPending: boolean,
  fallbackPermissions: Array<string>,
): Array<string> | null {
  if (roleId) {
    if (isRolePermissionsPending) return null
    return rolePermissions ?? []
  }
  return fallbackPermissions
}

export function usePhysicalWarehouseAccess() {
  const { data: user } = useQuery(profileQueryOptions)
  const roleId = getCurrentUserRoleId(user)
  const {
    data: rolePermissions,
    isPending: isRolePermissionsPending,
  } = useQuery({
    ...rolePermissionsQueryOptions(roleId ?? ''),
    enabled: Boolean(roleId),
  })

  return useMemo(() => {
    const permissions = resolveEffectivePermissions(
      roleId,
      rolePermissions?.rules.permissions,
      isRolePermissionsPending,
      getPermissionsFromUser(user),
    )
    const isAccessReady = permissions !== null
    const effectivePermissions = permissions ?? []

    return {
      permissions: effectivePermissions,
      isAccessReady,
      canViewPhysicalWarehouse: isAccessReady
        ? canViewPhysicalWarehouse(effectivePermissions)
        : false,
      canManageLocations: isAccessReady
        ? canManagePhysicalWarehouseLocations(effectivePermissions)
        : false,
      canManageWarehouses: isAccessReady
        ? canManagePhysicalWarehouses(effectivePermissions)
        : false,
      canManageWarehouseContents: isAccessReady
        ? canManagePhysicalWarehouseContents(effectivePermissions)
        : false,
      canManageItems: isAccessReady
        ? canManagePhysicalWarehouseItems(effectivePermissions)
        : false,
    }
  }, [user, roleId, rolePermissions, isRolePermissionsPending])
}
