import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

const FOLDER_BROWSE_ALL_PERMISSION = 'folders.browse_all'
const FOLDER_BROWSE_ASSIGNED_PERMISSION = 'folders.browse_assigned'

export function useFolderBrowsePermissions() {
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
    const hasBrowseAll = isPermissionGranted(
      permissions,
      FOLDER_BROWSE_ALL_PERMISSION,
      'folders',
    )
    const hasBrowseAssigned = isPermissionGranted(
      permissions,
      FOLDER_BROWSE_ASSIGNED_PERMISSION,
      'folders',
    )

    return {
      hasBrowseAll,
      hasBrowseAssigned,
      // browse_all is the stronger permission and takes precedence.
      useGlobalBrowseScope: hasBrowseAll,
    }
  }, [user, rolePermissions])
}
