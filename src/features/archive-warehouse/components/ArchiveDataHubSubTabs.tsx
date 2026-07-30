import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ARCHIVE_DATA_HUB_TAB_CONFIG } from '@/features/archive-warehouse/lib/archiveDataHubTabConfig'
import { useArchiveDataHubAvailableTabs } from '@/features/archive-warehouse/hooks/useArchiveDataHubAvailableTabs'
import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'
import {
  warehouseTabsListClassName,
  warehouseTabsTriggerCompactClassName,
} from '@/features/warehouse-management/components/WarehouseManagementBackNav'
import { cn } from '@/lib/utils/cn'

function resolveActiveDataHubTab(pathname: string, searchTab?: string): ArchiveDataHubTabT | undefined {
  if (pathname.startsWith('/app/archive-dossiers')) {
    return 'dossiers'
  }
  if (pathname === '/app/archive-warehouse' && searchTab) {
    return searchTab as ArchiveDataHubTabT
  }
  return undefined
}

export function useArchiveDataHubSubTabsVisible(): boolean {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const search = useRouterState({
    select: (state) => state.location.search as { tab?: string },
  })

  return useMemo(() => {
    if (pathname.startsWith('/app/archive-dossiers')) return true
    if (pathname === '/app/archive-warehouse' && search.tab) return true
    return false
  }, [pathname, search.tab])
}

export function ArchiveDataHubSubTabs() {
  const { t } = useTranslation('archive-warehouse')
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const search = useRouterState({
    select: (state) =>
      state.location.search as { tab?: string; limit?: number },
  })
  const availableTabs = useArchiveDataHubAvailableTabs()

  const activeTab = resolveActiveDataHubTab(pathname, search.tab)
  const visibleTabs = ARCHIVE_DATA_HUB_TAB_CONFIG.filter((item) =>
    availableTabs.includes(item.value),
  )

  if (!activeTab || visibleTabs.length === 0) return null

  return (
    <nav
      className={cn(warehouseTabsListClassName, 'border-b-0')}
      aria-label={t('hub.subTabsAriaLabel')}
    >
      {visibleTabs.map((item) => {
        const Icon = item.icon
        const isActive = activeTab === item.value

        return (
          <button
            key={item.value}
            type="button"
            className={cn(
              warehouseTabsTriggerCompactClassName,
              'inline-flex items-center',
            )}
            data-state={isActive ? 'active' : 'inactive'}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => {
              void navigate({
                to: '/app/archive-warehouse',
                search: (prev: Record<string, unknown>) => {
                  if (item.value === 'dossiers') {
                    return {
                      tab: 'dossiers',
                      browseView: 'fonds',
                      page: 1,
                      limit: (prev.limit as number | undefined) ?? search.limit,
                    }
                  }
                  if (item.value === 'expiryReview' || item.value === 'disposalProposal') {
                    return {
                      tab: item.value,
                      page: 1,
                      limit: (prev.limit as number | undefined) ?? search.limit,
                    }
                  }
                  return {
                    ...prev,
                    tab: item.value,
                    page: 1,
                  }
                },
              })
            }}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {t(item.labelKey)}
          </button>
        )
      })}
    </nav>
  )
}
