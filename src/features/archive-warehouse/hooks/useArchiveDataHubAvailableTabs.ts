import { useMemo } from 'react'

import { useArchiveConfigAccess } from '@/features/archive-config/hooks/useArchiveConfigAccess'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'

export function useArchiveDataHubAvailableTabs(): Array<ArchiveDataHubTabT> {
  const { canReadArchiveWarehouse, canManageArchivePermissions } =
    useArchiveWarehouseAccess()
  const { canSubmitArchive, canReviewArchive } = useArchiveSubmissionAccess()
  const { canManageArchiveConfig } = useArchiveConfigAccess()

  const primaryRole = getPrimaryAppRole(getUserRoles())
  const canOpenPermissionTab =
    canManageArchivePermissions ||
    primaryRole === 'admin' ||
    primaryRole === 'manager'

  return useMemo(() => {
    const tabs: Array<ArchiveDataHubTabT> = []
    if (canReadArchiveWarehouse) tabs.push('dossiers')
    if (canSubmitArchive) tabs.push('submission')
    if (canReviewArchive) tabs.push('review')
    if (canManageArchiveConfig) tabs.push('config')
    if (canOpenPermissionTab) tabs.push('permission')
    return tabs
  }, [
    canReadArchiveWarehouse,
    canSubmitArchive,
    canReviewArchive,
    canManageArchiveConfig,
    canOpenPermissionTab,
  ])
}
