import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { disposalSettingsQueryOptions } from '@/features/archive-disposal-council/queries'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import { useArchiveConfigAccess } from '@/features/archive-config/hooks/useArchiveConfigAccess'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'
import { resolveArchiveDataHubTabs } from '@/features/archive-warehouse/lib/archiveDataHubTabs'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'

export function useArchiveDataHubAvailableTabs(): Array<ArchiveDataHubTabT> {
  const { canReadArchiveWarehouse, canManageArchivePermissions } =
    useArchiveWarehouseAccess()
  const { canReadDisposal } = useArchiveDisposalAccess()
  const { canSubmitArchive, canReviewArchive } = useArchiveSubmissionAccess()
  const { canManageArchiveConfig } = useArchiveConfigAccess()
  const { canReadCouncil } = useDisposalCouncilAccess()
  const { data: disposalSettings } = useQuery(disposalSettingsQueryOptions())

  const primaryRole = getPrimaryAppRole(getUserRoles())
  const canOpenPermissionTab =
    canManageArchivePermissions ||
    primaryRole === 'admin' ||
    primaryRole === 'manager'

  const councilReviewEnabled = disposalSettings?.councilReviewEnabled ?? true

  return useMemo(
    () =>
      resolveArchiveDataHubTabs({
        canReadArchiveWarehouse,
        canReadDisposal,
        councilReviewEnabled,
        canReadCouncil,
        canSubmitArchive,
        canReviewArchive,
        canManageArchiveConfig,
        canOpenPermissionTab,
      }),
    [
      canReadArchiveWarehouse,
      canReadDisposal,
      councilReviewEnabled,
      canReadCouncil,
      canSubmitArchive,
      canReviewArchive,
      canManageArchiveConfig,
      canOpenPermissionTab,
    ],
  )
}
