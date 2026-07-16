import { useMemo } from 'react'

import {
  canCreateFonds,
  canDeleteFonds,
  canUpdateFonds,
  canViewFonds,
} from '@/features/archive-fond/lib/fondAccess'
import { useEffectivePermissions } from '@/features/auth/hooks/useEffectivePermissions'

export function useFondAccess() {
  const permissions = useEffectivePermissions()

  return useMemo(
    () => ({
      permissions,
      canViewFonds: canViewFonds(permissions),
      canCreateFonds: canCreateFonds(permissions),
      canUpdateFonds: canUpdateFonds(permissions),
      canDeleteFonds: canDeleteFonds(permissions),
    }),
    [permissions],
  )
}
