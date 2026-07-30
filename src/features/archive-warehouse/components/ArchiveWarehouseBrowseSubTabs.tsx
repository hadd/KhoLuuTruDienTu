import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useMemo } from 'react'

import { ArchiveWarehouseBrowseTabs } from '@/features/archive-warehouse/components/ArchiveWarehouseBrowseTabs'
import {
  isArchiveWarehouseDossiersModuleActive,
  resolveArchiveWarehouseBrowseView,
} from '@/features/archive-warehouse/lib/resolveArchiveWarehouseBrowseView'
import type { ArchiveWarehouseBrowseViewT } from '@/features/archive-warehouse/schemas'

function extractFondIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/app\/archive-dossiers\/([^/]+)/)
  return match?.[1]
}

export function useArchiveWarehouseBrowseSubTabsVisible(): boolean {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const tab = useRouterState({
    select: (state) =>
      (state.location.search as { tab?: string }).tab,
  })

  return useMemo(
    () => isArchiveWarehouseDossiersModuleActive(pathname, tab),
    [pathname, tab],
  )
}

export function ArchiveWarehouseBrowseSubTabs() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const search = useRouterState({
    select: (state) =>
      state.location.search as {
        tab?: string
        browseView?: string
        limit?: number
        pickerMode?: boolean
        disposalCatalogId?: string
      },
  })

  const activeBrowseView = resolveArchiveWarehouseBrowseView({
    pathname,
    tab: search.tab,
    browseView: search.browseView,
    fondId: extractFondIdFromPath(pathname),
  })

  if (!activeBrowseView) return null

  function navigateToBrowseView(view: ArchiveWarehouseBrowseViewT) {
    void navigate({
      to: '/app/archive-warehouse',
      search: {
        tab: 'dossiers',
        browseView: view,
        page: 1,
        limit: search.limit,
        ...(search.pickerMode
          ? {
              pickerMode: true,
              disposalCatalogId: search.disposalCatalogId,
            }
          : {}),
      },
    })
  }

  return (
    <ArchiveWarehouseBrowseTabs
      browseView={activeBrowseView}
      onBrowseViewChange={navigateToBrowseView}
    />
  )
}
