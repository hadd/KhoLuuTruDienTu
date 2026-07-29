import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useAuditLogAccess() {
  const { data: user } = useQuery(profileQueryOptions)
  const roleId = getCurrentUserRoleId(user)
  const { data: rolePermissions } = useQuery({
    ...rolePermissionsQueryOptions(roleId ?? ''),
    enabled: Boolean(roleId),
  })

  const permissions = useMemo(
    () =>
      resolvePermissionsForUser(
        user,
        rolePermissions?.rules.permissions ?? null,
      ),
    [user, rolePermissions],
  )

  return {
    canView: isPermissionGranted(permissions, 'audit_logs.read', 'audit_logs'),
    canDelete: isPermissionGranted(
      permissions,
      'audit_logs.delete',
      'audit_logs',
    ),
    canExport: isPermissionGranted(
      permissions,
      'audit_logs.export',
      'audit_logs',
    ),
  }
}
