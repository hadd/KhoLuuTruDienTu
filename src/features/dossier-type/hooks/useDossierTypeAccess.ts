import { useMemo } from 'react'

import { useEffectivePermissions } from '@/features/auth/hooks/useEffectivePermissions'
import {
  canCreateDossierTypes,
  canDeleteDossierTypes,
  canUpdateDossierTypes,
  canViewDossierTypes,
} from '@/features/dossier-type/lib/dossierTypeAccess'

export function useDossierTypeAccess() {
  const permissions = useEffectivePermissions()

  return useMemo(
    () => ({
      permissions,
      canViewDossierTypes: canViewDossierTypes(permissions),
      canCreateDossierTypes: canCreateDossierTypes(permissions),
      canUpdateDossierTypes: canUpdateDossierTypes(permissions),
      canDeleteDossierTypes: canDeleteDossierTypes(permissions),
    }),
    [permissions],
  )
}
