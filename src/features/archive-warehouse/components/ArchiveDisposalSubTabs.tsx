import { useQuery } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useMemo } from 'react'

import { ArchiveDisposalTabs } from '@/features/archive-warehouse/components/ArchiveDisposalTabs'
import { disposalSettingsQueryOptions } from '@/features/archive-disposal-council/queries'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import {
  isArchiveDisposalModuleActive,
  resolveArchiveDisposalView,
} from '@/features/archive-warehouse/lib/resolveArchiveDisposalView'
import type { ArchiveDisposalViewT } from '@/features/archive-warehouse/schemas'

export function useArchiveDisposalSubTabsVisible(): boolean {
  const tab = useRouterState({
    select: (state) => (state.location.search as { tab?: string }).tab,
  })
  return useMemo(() => isArchiveDisposalModuleActive(tab), [tab])
}

export function ArchiveDisposalSubTabs() {
  const navigate = useNavigate()
  const search = useRouterState({
    select: (state) =>
      state.location.search as {
        tab?: string
        disposalView?: string
        limit?: number
      },
  })
  const { canReadDisposal } = useArchiveDisposalAccess()
  const { data: disposalSettings } = useQuery(disposalSettingsQueryOptions())
  const councilReviewEnabled = disposalSettings?.councilReviewEnabled ?? true

  const activeView = resolveArchiveDisposalView({
    tab: search.tab,
    disposalView: search.disposalView,
    councilReviewEnabled,
  })

  if (!activeView || !canReadDisposal) return null

  const showProposal = councilReviewEnabled && canReadDisposal

  function navigateToDisposalView(view: ArchiveDisposalViewT) {
    void navigate({
      to: '/app/archive-warehouse',
      search: {
        tab: 'expiryReview',
        disposalView: view,
        page: 1,
        limit: search.limit,
      },
    })
  }

  return (
    <ArchiveDisposalTabs
      disposalView={activeView}
      showProposal={showProposal}
      onDisposalViewChange={navigateToDisposalView}
    />
  )
}
