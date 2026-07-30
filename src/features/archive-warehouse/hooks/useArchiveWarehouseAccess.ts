import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  ARCHIVE_WAREHOUSE_PERMISSIONS,
  hasArchiveWarehousePermission,
} from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useArchiveWarehouseAccess() {
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

    const canReadArchiveWarehouse =
      hasArchiveWarehousePermission(
        permissions,
        ARCHIVE_WAREHOUSE_PERMISSIONS.read,
      ) ||
      hasArchiveWarehousePermission(
        permissions,
        ARCHIVE_WAREHOUSE_PERMISSIONS.search,
      ) ||
      hasArchiveWarehousePermission(
        permissions,
        ARCHIVE_WAREHOUSE_PERMISSIONS.edit,
      ) ||
      hasArchiveWarehousePermission(
        permissions,
        ARCHIVE_WAREHOUSE_PERMISSIONS.delete,
      ) ||
      hasArchiveWarehousePermission(
        permissions,
        ARCHIVE_WAREHOUSE_PERMISSIONS.reupload,
      )

    const canManageArchivePermissions = isPermissionGranted(
      permissions,
      'archive.permissions.manage',
      'archive.warehouse',
    )

    return {
      permissions,
      canReadArchiveWarehouse,
      canManageArchivePermissions,
    }
  }, [user, rolePermissions])
}
