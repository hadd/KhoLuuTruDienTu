import { useQuery } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useMemo } from 'react'

import { ArchiveDisposalTabs } from '@/features/archive-warehouse/components/ArchiveDisposalTabs'
import { disposalSettingsQueryOptions } from '@/features/archive-disposal-council/queries'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import {
  isArchiveDisposalModuleActive,
  resolveArchiveDisposalView,
} from '@/features/archive-warehouse/lib/resolveArchiveDisposalView'
import type {
  ArchiveDataHubSearchT,
  ArchiveDisposalViewT,
} from '@/features/archive-warehouse/schemas'

export function useArchiveDisposalSubTabsVisible(): boolean {
  const tab = useRouterState({
    select: (state) => (state.location.search as { tab?: string }).tab,
  })
  return useMemo(() => isArchiveDisposalModuleActive(tab), [tab])
}

export function ArchiveDisposalSubTabs() {
  const navigate = useNavigate()
  const search = useRouterState({
    select: (state) => state.location.search as ArchiveDataHubSearchT,
  })
  const { canReadDisposal } = useArchiveDisposalAccess()
  const { canReadCouncil } = useDisposalCouncilAccess()
  const { data: disposalSettings } = useQuery(disposalSettingsQueryOptions())
  const councilReviewEnabled = disposalSettings?.councilReviewEnabled ?? true
  const canOpenDisposalModule = canReadDisposal || canReadCouncil

  const activeView = resolveArchiveDisposalView({
    tab: search.tab,
    disposalView: search.disposalView,
    councilReviewEnabled,
  })

  if (!activeView || !canOpenDisposalModule) return null

  const showProposal = councilReviewEnabled && canOpenDisposalModule
  const showList = canReadDisposal

  function navigateToDisposalView(view: ArchiveDisposalViewT) {
    void navigate({
      to: '/app/archive-warehouse',
      search: (prev) => ({
        ...(prev as ArchiveDataHubSearchT),
        tab: 'expiryReview',
        disposalView: view,
        page: 1,
        ...(view === 'list'
          ? {
              disposalAppendCatalogId: undefined,
              searchFondId: undefined,
              pickerMode: undefined,
            }
          : {}),
      }),
    })
  }

  const showSoftDeleted = canReadDisposal

  return (
    <ArchiveDisposalTabs
      disposalView={activeView}
      showProposal={showProposal}
      showList={showList}
      showSoftDeleted={showSoftDeleted}
      onDisposalViewChange={navigateToDisposalView}
    />
  )
}
