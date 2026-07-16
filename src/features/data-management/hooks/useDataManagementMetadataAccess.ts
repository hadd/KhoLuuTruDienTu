import { useMemo } from 'react'

import { useEffectivePermissions } from '@/features/auth/hooks/useEffectivePermissions'
import { canEditDossierMetadataSummary } from '@/features/data-management/lib/dossierMetadataAccess'

export function useDataManagementMetadataAccess() {
  const permissions = useEffectivePermissions()

  return useMemo(
    () => ({
      permissions,
      canEditSummaryMetadata: canEditDossierMetadataSummary(permissions),
    }),
    [permissions],
  )
}
