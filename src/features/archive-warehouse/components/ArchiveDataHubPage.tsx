import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ArchiveFieldConfigPage } from '@/features/archive-config/components/ArchiveFieldConfigPage'
import { useArchiveConfigAccess } from '@/features/archive-config/hooks/useArchiveConfigAccess'
import { ArchiveDisposalProposalPage } from '@/features/archive-disposal/components/ArchiveDisposalProposalPage'
import { ArchiveExpiryDuplicatePage } from '@/features/archive-disposal/components/ArchiveExpiryDuplicatePage'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import { disposalSettingsQueryOptions } from '@/features/archive-disposal-council/queries'
import { ArchivePermissionConfigPage } from '@/features/archive-permission/components/ArchivePermissionConfigPage'
import { ArchiveReviewPage } from '@/features/archive-review/components/ArchiveReviewPage'
import { ArchiveSubmissionPage } from '@/features/archive-submission/components/ArchiveSubmissionPage'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import { ArchiveWarehouseDataShell } from '@/features/archive-warehouse/components/ArchiveWarehouseDataShell'
import { ArchiveWarehouseDrillDownHeader } from '@/features/archive-warehouse/components/ArchiveWarehouseDrillDownHeader'
import { ArchiveWarehouseFondsPage } from '@/features/archive-warehouse/components/ArchiveWarehouseFondsPage'
import { ArchiveWarehouseHubNavGrid } from '@/features/archive-warehouse/components/ArchiveWarehouseHubNavGrid'
import { useArchiveDataHubAvailableTabs } from '@/features/archive-warehouse/hooks/useArchiveDataHubAvailableTabs'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import { buildHubTabBreadcrumbSegments } from '@/features/archive-warehouse/lib/archiveWarehouseBreadcrumb'
import { resolveArchiveDisposalView } from '@/features/archive-warehouse/lib/resolveArchiveDisposalView'
import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'
import { BROWSE_VIEW_LABEL_KEYS } from '@/features/archive-warehouse/schemas'

const routeApi = getRouteApi('/app/archive-warehouse/')

const TAB_LABEL_KEYS: Record<ArchiveDataHubTabT, `tabs.${ArchiveDataHubTabT}`> = {
  dossiers: 'tabs.dossiers',
  expiryReview: 'tabs.expiryReview',
  disposalProposal: 'tabs.disposalProposal',
  disposalCouncil: 'tabs.disposalCouncil',
  submission: 'tabs.submission',
  review: 'tabs.review',
  config: 'tabs.config',
  permission: 'tabs.permission',
}

const DISPOSAL_VIEW_LABEL_KEYS = {
  list: 'disposal.subTabList',
  proposal: 'disposal.subTabProposal',
} as const

export function ArchiveDataHubPage() {
  const { t } = useTranslation('archive-warehouse')
  const search = routeApi.useSearch()
  const navigate = useNavigate({ from: '/app/archive-warehouse/' })
  const { canReadArchiveWarehouse } = useArchiveWarehouseAccess()
  const { canReadDisposal } = useArchiveDisposalAccess()
  const { canSubmitArchive, canReviewArchive } = useArchiveSubmissionAccess()
  const { canManageArchiveConfig } = useArchiveConfigAccess()
  const { data: disposalSettings } = useQuery(disposalSettingsQueryOptions())
  const councilReviewEnabled = disposalSettings?.councilReviewEnabled ?? true

  const availableTabs = useArchiveDataHubAvailableTabs()

  const tab = search.tab
  const browseView = search.browseView
  const disposalView = resolveArchiveDisposalView({
    tab,
    disposalView: search.disposalView,
    councilReviewEnabled,
  })

  useEffect(() => {
    if (tab === 'disposalProposal' || tab === 'disposalCouncil') {
      void navigate({
        search: (prev) => ({
          ...prev,
          tab: 'expiryReview',
          disposalView: 'proposal',
          page: 1,
        }),
        replace: true,
      })
      return
    }

    if (
      tab === 'expiryReview' &&
      search.disposalView === 'proposal' &&
      !councilReviewEnabled
    ) {
      void navigate({
        search: (prev) => ({
          ...prev,
          disposalView: 'list',
          page: 1,
        }),
        replace: true,
      })
      return
    }

    if (availableTabs.length === 0) return
    if (tab && !availableTabs.some((item) => item === tab)) {
      void navigate({
        search: (prev) => ({ ...prev, tab: undefined, page: 1 }),
        replace: true,
      })
    }
  }, [availableTabs, tab, search.disposalView, councilReviewEnabled, navigate])

  function navigateToHubRoot() {
    void navigate({
      search: (prev) => ({ ...prev, tab: undefined, page: 1 }),
    })
  }

  function navigateBack() {
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
        { label: tabLabel },
        { label: t(BROWSE_VIEW_LABEL_KEYS[browseView]) },
      ]
    }

    if (tab === 'expiryReview' && disposalView) {
      return [
        base[0]!,
        { label: tabLabel },
        { label: t(DISPOSAL_VIEW_LABEL_KEYS[disposalView]) },
      ]
    }

    return base
  }, [browseView, disposalView, tab, t])

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
          backAriaLabel={t('hub.backToModules')}
        />

        {tab === 'dossiers' && canReadArchiveWarehouse ? (
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            <ArchiveWarehouseFondsPage embedded />
          </div>
        ) : null}
        {tab === 'expiryReview' && canReadDisposal && disposalView === 'list' ? (
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            <ArchiveExpiryDuplicatePage />
          </div>
        ) : null}
        {tab === 'expiryReview' &&
        canReadDisposal &&
        disposalView === 'proposal' &&
        councilReviewEnabled ? (
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            <ArchiveDisposalProposalPage />
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
        {tab === 'permission' && availableTabs.includes('permission') ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ArchivePermissionConfigPage embedded />
          </div>
        ) : null}
      </div>
    </ArchiveWarehouseDataShell>
  )
}
