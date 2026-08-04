import { getRouteApi, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { BookOpenCheck, CheckCircle2 } from 'lucide-react'

import { ArchiveBorrowApprovalPage } from '@/features/archive-borrow/components/ArchiveBorrowApprovalPage'
import { MyArchiveBorrowRequestsPage } from '@/features/archive-borrow/components/MyArchiveBorrowRequestsPage'
import { useArchiveBorrowAccess } from '@/features/archive-borrow/hooks/useArchiveBorrowAccess'
import {
  sectionBoxedTabsListClassName,
  sectionBoxedTabsTriggerCompactClassName,
} from '@/features/navigation/components/SectionBackNav'
import { cn } from '@/lib/utils/cn'

const routeApi = getRouteApi('/app/library/')

export function LibraryPage() {
  const { t } = useTranslation('archive-warehouse')
  const { t: tCommon } = useTranslation('common')
  const search = routeApi.useSearch()
  const { canRequestBorrow, canReviewBorrow } = useArchiveBorrowAccess()

  const activeTab = search.tab

  const tabs = []
  if (canRequestBorrow) {
    tabs.push({
      id: 'borrow',
      to: '/app/library' as const,
      search: { tab: 'borrow' as const },
      label: t('tabs.borrow'),
      icon: BookOpenCheck,
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
      <div className="flex min-h-0 flex-1 flex-col items-center px-6 pt-10 pb-16 sm:pt-14">
        <div className="flex w-full max-w-5xl flex-col items-center gap-8 sm:gap-10">
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
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <nav
        className={cn(sectionBoxedTabsListClassName, 'shrink-0 pt-4 px-6')}
        aria-label="Library sections"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.id === activeTab

          return (
            <Link
              key={tab.id}
              to={tab.to}
              search={tab.search}
              className={cn(
                sectionBoxedTabsTriggerCompactClassName,
                'inline-flex items-center',
              )}
              data-state={isActive ? 'active' : 'inactive'}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'borrow' && canRequestBorrow ? (
          <div className="h-full overflow-y-auto px-6 py-4">
            <MyArchiveBorrowRequestsPage />
          </div>
        ) : null}
        {activeTab === 'borrowReview' && canReviewBorrow ? (
          <div className="h-full overflow-y-auto px-6 py-4">
            <ArchiveBorrowApprovalPage />
          </div>
        ) : null}
      </div>
    </div>
  )
}
