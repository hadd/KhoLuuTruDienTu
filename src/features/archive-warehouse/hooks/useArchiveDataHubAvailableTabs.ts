import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useArchiveBorrowAccess } from '@/features/archive-borrow/hooks/useArchiveBorrowAccess'
import { useArchiveConfigAccess } from '@/features/archive-config/hooks/useArchiveConfigAccess'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import { disposalSettingsQueryOptions } from '@/features/archive-disposal-council/queries'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import { resolveArchiveDataHubTabs } from '@/features/archive-warehouse/lib/archiveDataHubTabs'
import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'

export function useArchiveDataHubAvailableTabs(): Array<ArchiveDataHubTabT> {
  const { canReadArchiveWarehouse, canManageArchivePermissions } =
    useArchiveWarehouseAccess()
  const { canReadDisposal } = useArchiveDisposalAccess()
  const { canSubmitArchive, canReviewArchive } = useArchiveSubmissionAccess()
  const { canRequestBorrow, canReviewBorrow } = useArchiveBorrowAccess()
  const { canManageArchiveConfig } = useArchiveConfigAccess()
  const { canReadCouncil, canReadDisposalSettings } = useDisposalCouncilAccess()
  const { data: disposalSettings } = useQuery({
    ...disposalSettingsQueryOptions(),
    enabled: canReadDisposalSettings,
  })

  const primaryRole = getPrimaryAppRole(getUserRoles())
  const canOpenPermissionTab =
    canManageArchivePermissions ||
    primaryRole === 'admin' ||
    primaryRole === 'manager'

  const councilReviewEnabled = canReadDisposalSettings
    ? (disposalSettings?.councilReviewEnabled ?? true)
    : true

  return useMemo(
    () =>
      resolveArchiveDataHubTabs({
        canReadArchiveWarehouse,
        canReadDisposal,
        councilReviewEnabled,
        canReadCouncil,
        canSubmitArchive,
        canReviewArchive,
        canRequestBorrow,
        canReviewBorrow,
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
      canRequestBorrow,
      canReviewBorrow,
      canManageArchiveConfig,
      canOpenPermissionTab,
    ],
  )
}
