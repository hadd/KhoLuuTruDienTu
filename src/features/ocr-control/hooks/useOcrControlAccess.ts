import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import { hasFullAccess, isPermissionGranted } from '@/features/permissions/lib/permissionRules'

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
    const canControlOcr =
      hasFullAccess(permissions) ||
      isPermissionGranted(permissions, 'ocr-control.manage', 'ocr-control') ||
      isPermissionGranted(permissions, 'ocr-control.*', 'ocr-control')

    return {
      permissions,
      canViewOcrControl: canControlOcr,
      canControlOcr,
      canTriggerOcr: canControlOcr,
    }
  }, [user, rolePermissions])
}
