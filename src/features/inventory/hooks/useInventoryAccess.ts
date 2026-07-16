import { useMemo } from 'react'

import { useEffectivePermissions } from '@/features/auth/hooks/useEffectivePermissions'
import {
  canCreateInventories,
  canDeleteInventories,
  canUpdateInventories,
  canViewInventories,
} from '@/features/inventory/lib/inventoryAccess'

export function useInventoryAccess() {
  const permissions = useEffectivePermissions()

  return useMemo(
    () => ({
      permissions,
      canViewInventories: canViewInventories(permissions),
      canCreateInventories: canCreateInventories(permissions),
      canUpdateInventories: canUpdateInventories(permissions),
      canDeleteInventories: canDeleteInventories(permissions),
    }),
    [permissions],
  )
}
