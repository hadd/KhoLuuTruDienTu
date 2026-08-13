import { getRouteApi, Link } from '@tanstack/react-router'
import { BookMarked, BookOpenCheck, CheckCircle2, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ArchiveBorrowApprovalPage } from '@/features/archive-borrow/components/ArchiveBorrowApprovalPage'
import { ArchiveBorrowReadingPage } from '@/features/archive-borrow/components/ArchiveBorrowReadingPage'
import { MyArchiveBorrowRequestsPage } from '@/features/archive-borrow/components/MyArchiveBorrowRequestsPage'
import { useArchiveBorrowAccess } from '@/features/archive-borrow/hooks/useArchiveBorrowAccess'
import { LibraryPageShell } from '@/features/library/components/LibraryPageShell'
import { useLibraryExploitationAccess } from '@/features/library/hooks/useLibraryExploitationAccess'
import {
  IconHubPageLayout,
  iconHubTileGridGapClassName,
  iconHubTileIconClassName,
  iconHubTileIconWrapClassName,
  iconHubTileLabelClassName,
  iconHubTileLinkClassName,
} from '@/features/navigation/components/IconHubPageLayout'
import { cn } from '@/lib/utils/cn'

const routeApi = getRouteApi('/app/library/')

export function LibraryPage() {
  const { t } = useTranslation('archive-warehouse')
  const { t: tCommon } = useTranslation('common')
  const search = routeApi.useSearch()
  const { canRequestBorrow, canReviewBorrow } = useArchiveBorrowAccess()
  const { canReadExploitation } = useLibraryExploitationAccess()

  const activeTab = search.tab

  const tabs = []
  if (canReadExploitation) {
    tabs.push({
      id: 'exploitation',
      to: '/app/library/exploitation' as const,
      search: undefined,
      label: t('tabs.exploitation'),
      icon: FolderOpen,
    })
  }
  if (canRequestBorrow) {
    tabs.push({
      id: 'borrow',
      to: '/app/library' as const,
      search: { tab: 'borrow' as const },
      label: t('tabs.borrow'),
      icon: BookOpenCheck,
    })
  }
  if (canReadExploitation) {
    tabs.push({
      id: 'reading',
      to: '/app/library' as const,
      search: { tab: 'reading' as const },
      label: t('tabs.reading'),
      icon: BookMarked,
    })
  }
  if (canReviewBorrow) {
    tabs.push({
      id: 'borrowReview',
      to: '/app/library' as const,
      search: { tab: 'borrowReview' as const },
      label: t('tabs.borrowReview'),
      icon: CheckCircle2,
    })
  }

  if (!activeTab) {
    if (tabs.length === 0) {
      return (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {t('hub.noPermission')}
        </div>
      )
    }

    return (
      <LibraryPageShell hideTabs contentClassName="p-0">
        <IconHubPageLayout
          title={tCommon('admin.library')}
          maxWidth={tabs.length <= 2 ? 'max-w-3xl' : 'max-w-6xl'}
        >
          <div
            className={cn(
              'grid w-full',
              iconHubTileGridGapClassName,
              tabs.length === 1
                ? 'max-w-xs grid-cols-1'
                : tabs.length === 2
                  ? 'max-w-xl grid-cols-1 sm:grid-cols-2'
                  : tabs.length === 3
                    ? 'grid-cols-1 sm:grid-cols-3'
                    : 'grid-cols-2 sm:grid-cols-4',
            )}
          >
            {tabs.map((tile) => {
              const Icon = tile.icon
              return (
                <Link
                  key={tile.id}
                  to={tile.to}
                  search={tile.search}
                  className={iconHubTileLinkClassName}
                >
                  <span className={iconHubTileIconWrapClassName}>
                    <Icon
                      className={iconHubTileIconClassName}
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </span>
                  <span className={iconHubTileLabelClassName}>{tile.label}</span>
                </Link>
              )
            })}
          </div>
        </IconHubPageLayout>
      </LibraryPageShell>
    )
  }

  return (
    <LibraryPageShell activeTab={activeTab}>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === 'borrow' && canRequestBorrow ? (
          <MyArchiveBorrowRequestsPage source="library" />
        ) : null}
        {activeTab === 'reading' && canReadExploitation ? (
          <ArchiveBorrowReadingPage source="library" />
        ) : null}
        {activeTab === 'borrowReview' && canReviewBorrow ? (
          <ArchiveBorrowApprovalPage />
        ) : null}
      </div>
    </LibraryPageShell>
  )
}
