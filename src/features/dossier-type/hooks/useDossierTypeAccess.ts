import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import {
  canCreateDossierTypes,
  canDeleteDossierTypes,
  canUpdateDossierTypes,
  canViewDossierTypes,
} from '@/features/dossier-type/lib/dossierTypeAccess'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useDossierTypeAccess() {
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
      canViewDossierTypes: canViewDossierTypes(permissions),
      canCreateDossierTypes: canCreateDossierTypes(permissions),
      canUpdateDossierTypes: canUpdateDossierTypes(permissions),
      canDeleteDossierTypes: canDeleteDossierTypes(permissions),
    }
  }, [user, rolePermissions])
}
