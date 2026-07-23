import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  canAccessScreen,
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

/** Viewing (dossiers.read) is already enforced by the route's beforeLoad; this hook also exposes trigger (dossiers.write) access for the UI. */
export function useOcrControlAccess() {
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
      canViewOcrControl: canAccessScreen(permissions, APP_SCREEN_ACCESS.ocrControl),
      canTriggerOcr: isPermissionGranted(permissions, 'dossiers.write', 'dossiers'),
    }
  }, [user, rolePermissions])
}
