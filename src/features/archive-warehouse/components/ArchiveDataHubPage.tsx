import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ArchiveFieldConfigPage } from '@/features/archive-config/components/ArchiveFieldConfigPage'
import { useArchiveConfigAccess } from '@/features/archive-config/hooks/useArchiveConfigAccess'
import { ArchivePermissionConfigPage } from '@/features/archive-permission/components/ArchivePermissionConfigPage'
import { ArchiveReviewPage } from '@/features/archive-review/components/ArchiveReviewPage'
import { ArchiveSubmissionPage } from '@/features/archive-submission/components/ArchiveSubmissionPage'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import { ArchiveWarehouseDataShell } from '@/features/archive-warehouse/components/ArchiveWarehouseDataShell'
import { ArchiveWarehouseFondsPage } from '@/features/archive-warehouse/components/ArchiveWarehouseFondsPage'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'

const routeApi = getRouteApi('/app/archive-warehouse/')

export function ArchiveDataHubPage() {
  const { t } = useTranslation('archive-warehouse')
  const search = routeApi.useSearch()
  const navigate = useNavigate({ from: '/app/archive-warehouse/' })
  const { canReadArchiveWarehouse, canManageArchivePermissions } =
    useArchiveWarehouseAccess()
  const { canSubmitArchive, canReviewArchive } = useArchiveSubmissionAccess()
  const { canManageArchiveConfig } = useArchiveConfigAccess()

  const primaryRole = getPrimaryAppRole(getUserRoles())
  const canOpenPermissionTab =
    canManageArchivePermissions ||
    primaryRole === 'admin' ||
    primaryRole === 'manager'

  const availableTabs = useMemo(() => {
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

  const tab = (search.tab ?? availableTabs[0] ?? 'dossiers') as ArchiveDataHubTabT

  useEffect(() => {
    if (availableTabs.length === 0) return
    if (!availableTabs.some((item) => item === tab)) {
      void navigate({
        search: (prev) => ({ ...prev, tab: availableTabs[0], page: 1 }),
        replace: true,
      })
    }
  }, [availableTabs, tab, navigate])

  if (availableTabs.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('hub.noPermission')}
      </div>
    )
  }

  return (
    <ArchiveWarehouseDataShell activeTab={tab} showBrowseTabs={false}>
      {tab === 'dossiers' && canReadArchiveWarehouse ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <ArchiveWarehouseFondsPage embedded />
        </div>
      ) : null}
      {tab === 'submission' && canSubmitArchive ? (
        <ArchiveSubmissionPage embedded />
      ) : null}
      {tab === 'review' && canReviewArchive ? (
        <ArchiveReviewPage embedded />
      ) : null}
      {tab === 'config' && canManageArchiveConfig ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ArchiveFieldConfigPage embedded />
        </div>
      ) : null}
      {tab === 'permission' && canOpenPermissionTab ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ArchivePermissionConfigPage embedded />
        </div>
      ) : null}
    </ArchiveWarehouseDataShell>
  )
}
