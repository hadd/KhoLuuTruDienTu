import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { ArchiveFieldConfigPage } from '@/features/archive-config/components/ArchiveFieldConfigPage'
import { useArchiveConfigAccess } from '@/features/archive-config/hooks/useArchiveConfigAccess'
import { ArchiveDisposalProposalPage } from '@/features/archive-disposal/components/ArchiveDisposalProposalPage'
import { ArchiveExpiryDuplicatePage } from '@/features/archive-disposal/components/ArchiveExpiryDuplicatePage'
import { ArchiveSoftDeletedDossiersPage } from '@/features/archive-disposal/components/ArchiveSoftDeletedDossiersPage'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import { disposalSettingsQueryOptions } from '@/features/archive-disposal-council/queries'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import { ArchivePermissionConfigPage } from '@/features/archive-permission/components/ArchivePermissionConfigPage'
import { ArchiveReviewPage } from '@/features/archive-review/components/ArchiveReviewPage'
import { ArchiveSubmissionPage } from '@/features/archive-submission/components/ArchiveSubmissionPage'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import { ArchiveWarehouseDataShell } from '@/features/archive-warehouse/components/ArchiveWarehouseDataShell'
import { ArchiveWarehouseFondsPage } from '@/features/archive-warehouse/components/ArchiveWarehouseFondsPage'
import { ArchiveWarehouseHubNavGrid } from '@/features/archive-warehouse/components/ArchiveWarehouseHubNavGrid'
import { useArchiveDataHubAvailableTabs } from '@/features/archive-warehouse/hooks/useArchiveDataHubAvailableTabs'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import { resolveArchiveDisposalView } from '@/features/archive-warehouse/lib/resolveArchiveDisposalView'

const routeApi = getRouteApi('/app/archive-warehouse/')

export function ArchiveDataHubPage() {
  const { t } = useTranslation('archive-warehouse')
  const search = routeApi.useSearch()
  const navigate = useNavigate({ from: '/app/archive-warehouse/' })
  const { canReadArchiveWarehouse } = useArchiveWarehouseAccess()
  const { canReadDisposal } = useArchiveDisposalAccess()
  const { canSubmitArchive, canReviewArchive } = useArchiveSubmissionAccess()
  const { canManageArchiveConfig } = useArchiveConfigAccess()
  const { canReadDisposalSettings, canReadCouncil } = useDisposalCouncilAccess()
  const { data: disposalSettings } = useQuery({
    ...disposalSettingsQueryOptions(),
    enabled: canReadDisposalSettings,
  })
  const councilReviewEnabled = canReadDisposalSettings
    ? (disposalSettings?.councilReviewEnabled ?? true)
    : true
  const canOpenDisposalProposal = canReadDisposal || canReadCouncil

  const availableTabs = useArchiveDataHubAvailableTabs()

  const tab = search.tab
  const disposalView = resolveArchiveDisposalView({
    tab,
    disposalView: search.disposalView,
    councilReviewEnabled,
  })

  useEffect(() => {
    if (tab === 'borrow' || tab === 'reading' || tab === 'borrowReview') {
      void navigate({
        to: '/app/library',
        search: { tab },
        replace: true,
      })
      return
    }

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
      !canReadDisposal &&
      canReadCouncil &&
      disposalView === 'list'
    ) {
      void navigate({
        search: (prev) => ({
          ...prev,
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
  }, [availableTabs, tab, search.disposalView, councilReviewEnabled, canReadDisposal, canReadCouncil, disposalView, navigate])

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
        {tab === 'dossiers' && canReadArchiveWarehouse ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ArchiveWarehouseFondsPage embedded />
          </div>
        ) : null}
        {tab === 'expiryReview' && canReadDisposal && !councilReviewEnabled ? (
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            <ArchiveSoftDeletedDossiersPage />
          </div>
        ) : null}
        {tab === 'expiryReview' && canReadDisposal && councilReviewEnabled && disposalView === 'list' ? (
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            <ArchiveExpiryDuplicatePage />
          </div>
        ) : null}
        {tab === 'expiryReview' &&
        canOpenDisposalProposal &&
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
