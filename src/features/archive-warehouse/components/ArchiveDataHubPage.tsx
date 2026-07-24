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
import { ArchiveWarehouseDrillDownHeader } from '@/features/archive-warehouse/components/ArchiveWarehouseDrillDownHeader'
import { ArchiveWarehouseFondsPage } from '@/features/archive-warehouse/components/ArchiveWarehouseFondsPage'
import { ArchiveWarehouseHubNavGrid } from '@/features/archive-warehouse/components/ArchiveWarehouseHubNavGrid'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import { buildHubTabBreadcrumbSegments } from '@/features/archive-warehouse/lib/archiveWarehouseBreadcrumb'
import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'
import { BROWSE_VIEW_LABEL_KEYS } from '@/features/archive-warehouse/schemas'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'

const routeApi = getRouteApi('/app/archive-warehouse/')

const TAB_LABEL_KEYS: Record<ArchiveDataHubTabT, `tabs.${ArchiveDataHubTabT}`> = {
  dossiers: 'tabs.dossiers',
  submission: 'tabs.submission',
  review: 'tabs.review',
  config: 'tabs.config',
  permission: 'tabs.permission',
}

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

  const tab = search.tab
  const browseView = search.browseView

  useEffect(() => {
    if (availableTabs.length === 0) return
    if (tab && !availableTabs.some((item) => item === tab)) {
      void navigate({
        search: (prev) => ({ ...prev, tab: undefined, page: 1 }),
        replace: true,
      })
    }
  }, [availableTabs, tab, navigate])

  function navigateToHubRoot() {
    void navigate({
      search: (prev) => ({ ...prev, tab: undefined, page: 1 }),
    })
  }

  function navigateToDossiersBrowsePicker() {
    void navigate({
      search: {
        tab: 'dossiers',
        page: 1,
        limit: search.limit,
      },
    })
  }

  function navigateBack() {
    if (tab === 'dossiers' && browseView) {
      navigateToDossiersBrowsePicker()
      return
    }
    navigateToHubRoot()
  }

  const headerSegments = useMemo(() => {
    if (!tab) return []
    const tabLabel = t(TAB_LABEL_KEYS[tab])
    const base = buildHubTabBreadcrumbSegments({
      hubRootLabel: t('breadcrumb.root'),
      tabLabel,
      onNavigateHub: navigateToHubRoot,
    })

    if (tab === 'dossiers' && browseView) {
      return [
        base[0]!,
        {
          label: tabLabel,
          onClick: navigateToDossiersBrowsePicker,
        },
        { label: t(BROWSE_VIEW_LABEL_KEYS[browseView]) },
      ]
    }

    return base
  }, [browseView, tab, t])

  if (availableTabs.length === 0) {
    return (
      <ArchiveWarehouseDataShell>
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {t('hub.noPermission')}
        </div>
      </ArchiveWarehouseDataShell>
    )
  }

  if (!tab) {
    return (
      <ArchiveWarehouseDataShell>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              {t('hub.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('hub.description')}</p>
          </div>
          <ArchiveWarehouseHubNavGrid availableTabs={availableTabs} />
        </div>
      </ArchiveWarehouseDataShell>
    )
  }

  return (
    <ArchiveWarehouseDataShell>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        <ArchiveWarehouseDrillDownHeader
          segments={headerSegments}
          onBack={navigateBack}
          backAriaLabel={
            tab === 'dossiers' && browseView
              ? t('page.backToBrowseModes')
              : t('hub.backToModules')
          }
        />

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
      </div>
    </ArchiveWarehouseDataShell>
  )
}
