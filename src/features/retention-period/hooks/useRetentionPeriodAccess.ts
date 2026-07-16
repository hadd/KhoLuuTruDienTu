import { useMemo } from 'react'

import { useEffectivePermissions } from '@/features/auth/hooks/useEffectivePermissions'
import {
  canCreateRetentionPeriods,
  canDeleteRetentionPeriods,
  canUpdateRetentionPeriods,
  canViewRetentionPeriods,
} from '@/features/retention-period/lib/retentionPeriodAccess'

export function useRetentionPeriodAccess() {
  const permissions = useEffectivePermissions()

  return useMemo(
    () => ({
      permissions,
      canViewRetentionPeriods: canViewRetentionPeriods(permissions),
      canCreateRetentionPeriods: canCreateRetentionPeriods(permissions),
      canUpdateRetentionPeriods: canUpdateRetentionPeriods(permissions),
      canDeleteRetentionPeriods: canDeleteRetentionPeriods(permissions),
    }),
    [permissions],
  )
}
