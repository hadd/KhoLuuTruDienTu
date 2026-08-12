import { Link, useRouterState } from '@tanstack/react-router'
import { BookMarked, BookOpenCheck, CheckCircle2, FolderOpen } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useArchiveBorrowAccess } from '@/features/archive-borrow/hooks/useArchiveBorrowAccess'
import { useLibraryExploitationAccess } from '@/features/library/hooks/useLibraryExploitationAccess'
import {
  sectionBoxedTabsListClassName,
  sectionBoxedTabsTriggerCompactClassName,
} from '@/features/navigation/components/SectionBackNav'
import { cn } from '@/lib/utils/cn'

type LibraryPageShellProps = {
  children: ReactNode
  activeTab?: 'exploitation' | 'borrow' | 'reading' | 'borrowReview'
  hideTabs?: boolean
  contentClassName?: string
}

export function LibraryPageShell({
  children,
  activeTab,
  hideTabs = false,
  contentClassName,
}: LibraryPageShellProps) {
  const { t } = useTranslation('archive-warehouse')
  const { canRequestBorrow, canReviewBorrow } = useArchiveBorrowAccess()
  const { canReadExploitation } = useLibraryExploitationAccess()
  const routerState = useRouterState()

  const pathname = routerState.location.pathname

  const isExploitationPath = pathname.startsWith('/app/library/exploitation')
  const activeKey =
    activeTab ??
    (isExploitationPath
      ? 'exploitation'
      : canReadExploitation
        ? 'exploitation'
        : canRequestBorrow
          ? 'borrow'
          : canReviewBorrow
            ? 'borrowReview'
            : undefined)

  const tabs = []
  if (canReadExploitation) {
    tabs.push({
      id: 'exploitation',
      to: '/app/library/exploitation' as const,
      search: undefined,
      label: t('tabs.exploitation'),
      icon: FolderOpen,
      isActive: activeKey === 'exploitation',
    })
  }
  if (canRequestBorrow) {
    tabs.push({
      id: 'borrow',
      to: '/app/library' as const,
      search: { tab: 'borrow' as const },
      label: t('tabs.borrow'),
      icon: BookOpenCheck,
      isActive: activeKey === 'borrow',
    })
  }
  if (canReadExploitation) {
    tabs.push({
      id: 'reading',
      to: '/app/library' as const,
      search: { tab: 'reading' as const },
      label: t('tabs.reading'),
      icon: BookMarked,
      isActive: activeKey === 'reading',
    })
  }
  if (canReviewBorrow) {
    tabs.push({
      id: 'borrowReview',
      to: '/app/library' as const,
      search: { tab: 'borrowReview' as const },
      label: t('tabs.borrowReview'),
      icon: CheckCircle2,
      isActive: activeKey === 'borrowReview',
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
      {!hideTabs ? (
        <nav
          className={cn(sectionBoxedTabsListClassName, 'shrink-0')}
          aria-label="Library sections"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <Link
                key={tab.id}
                to={tab.to}
                search={tab.search}
                className={cn(
                  sectionBoxedTabsTriggerCompactClassName,
                  'inline-flex items-center',
                )}
                data-state={tab.isActive ? 'active' : 'inactive'}
                aria-current={tab.isActive ? 'page' : undefined}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {tab.label}
              </Link>
            )
          })}
        </nav>
      ) : null}

      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-4',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
