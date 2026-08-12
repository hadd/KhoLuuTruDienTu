import { getRouteApi, Link } from '@tanstack/react-router'
import { BookMarked, BookOpenCheck, CheckCircle2, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ArchiveBorrowApprovalPage } from '@/features/archive-borrow/components/ArchiveBorrowApprovalPage'
import { ArchiveBorrowReadingPage } from '@/features/archive-borrow/components/ArchiveBorrowReadingPage'
import { MyArchiveBorrowRequestsPage } from '@/features/archive-borrow/components/MyArchiveBorrowRequestsPage'
import { useArchiveBorrowAccess } from '@/features/archive-borrow/hooks/useArchiveBorrowAccess'
import { LibraryPageShell } from '@/features/library/components/LibraryPageShell'
import { useLibraryExploitationAccess } from '@/features/library/hooks/useLibraryExploitationAccess'
import { IconHubBackLink } from '@/features/navigation/components/SectionBackNav'

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
      <LibraryPageShell hideTabs>
        <div className="flex min-h-0 flex-1 flex-col items-center px-6 pt-6 pb-16 sm:pt-10">
          <div className="flex w-full max-w-5xl flex-col items-center gap-8 sm:gap-10">
            <div className="w-full self-start">
              <IconHubBackLink
                to="/app/dashboard"
                parentLabel={tCommon('navigation.home')}
                backAriaLabel={tCommon('hubBack.aria', {
                  target: tCommon('navigation.home'),
                })}
              />
            </div>
            <h1 className="text-2xl font-bold uppercase tracking-[0.06em] text-primary sm:text-[1.75rem]">
              {tCommon('admin.library')}
            </h1>

            <div className="grid w-full grid-cols-2 gap-6 sm:gap-8 md:grid-cols-3 lg:grid-cols-5">
              {tabs.map((tile) => {
                const Icon = tile.icon
                return (
                  <Link
                    key={tile.id}
                    to={tile.to}
                    search={tile.search}
                    className="group flex flex-col items-center gap-3 outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex size-[4.5rem] items-center justify-center rounded-[1.25rem] bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 sm:size-20">
                      <Icon
                        className="size-9 sm:size-10"
                        strokeWidth={1.6}
                        aria-hidden
                      />
                    </span>
                    <span className="text-center text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary sm:text-[0.95rem]">
                      {tile.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
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
