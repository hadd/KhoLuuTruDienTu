import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useArchiveConfigAccess } from '@/features/archive-config/hooks/useArchiveConfigAccess'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import { disposalSettingsQueryOptions } from '@/features/archive-disposal-council/queries'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import { resolveArchiveDataHubTabs } from '@/features/archive-warehouse/lib/archiveDataHubTabs'
import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'

export function useArchiveDataHubAvailableTabs(): Array<ArchiveDataHubTabT> {
  const { canReadArchiveWarehouse, canManageArchivePermissions } =
    useArchiveWarehouseAccess()
  const { canReadDisposal } = useArchiveDisposalAccess()
  const { canSubmitArchive, canReviewArchive } = useArchiveSubmissionAccess()
  const { canManageArchiveConfig } = useArchiveConfigAccess()
  const { canReadCouncil, canFetchDisposalSettings, canManageDisposalSettings } = useDisposalCouncilAccess()
  const { data: disposalSettings } = useQuery({
    ...disposalSettingsQueryOptions(),
    enabled: canFetchDisposalSettings,
  })

  const canOpenPermissionTab = canManageArchivePermissions

  const councilReviewEnabled = canFetchDisposalSettings
    ? (disposalSettings?.councilReviewEnabled ?? true)
    : false

  return useMemo(
    () =>
      resolveArchiveDataHubTabs({
        canReadArchiveWarehouse,
        canReadDisposal,
        councilReviewEnabled,
        canReadCouncil,
        canSubmitArchive,
        canReviewArchive,
        canManageArchiveConfig: canManageArchiveConfig || canManageDisposalSettings,
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
      canManageDisposalSettings,
      canOpenPermissionTab,
    ],
  )
}
