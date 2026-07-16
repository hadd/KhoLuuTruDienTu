import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import {
  canCreateDocumentTypes,
  canDeleteDocumentTypes,
  canUpdateDocumentTypes,
  canViewDocumentTypes,
} from '@/features/document-type/lib/documentTypeAccess'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useDocumentTypeAccess() {
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
      canViewDocumentTypes: canViewDocumentTypes(permissions),
      canCreateDocumentTypes: canCreateDocumentTypes(permissions),
      canUpdateDocumentTypes: canUpdateDocumentTypes(permissions),
      canDeleteDocumentTypes: canDeleteDocumentTypes(permissions),
    }
  }, [user, rolePermissions])
}
