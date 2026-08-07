import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { BookMarked, StickyNote } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { ArchiveBorrowRequestsSource } from '@/features/archive-borrow/components/MyArchiveBorrowRequestsPage'
import { archiveBorrowReadingSummaryQueryOptions } from '@/features/archive-borrow/queries'
import type {
  ArchiveBorrowCurrentlyReadingT,
  ArchiveBorrowSavedItemT,
} from '@/features/archive-borrow/types'
import { translateError } from '@/lib/utils/translate-error'

function CurrentlyReadingCard({
  item,
  source,
}: {
  item: ArchiveBorrowCurrentlyReadingT
  source: ArchiveBorrowRequestsSource
}) {
  const { t } = useTranslation('archive-borrow')

  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium line-clamp-2">{item.reason}</p>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
        {item.fileName} · {t('reader.pageLabel', { page: item.page })}
      </p>
      <Button size="sm" className="mt-3" asChild>
        <Link
          to="/app/archive-borrow/$borrowId/view"
          params={{ borrowId: item.requestId }}
          search={{
            from: source,
            fileId: item.fileId,
            page: item.page,
          }}
        >
          {t('reader.continueReading')}
        </Link>
      </Button>
    </div>
  )
}

function SavedItemCard({
  item,
  source,
}: {
  item: ArchiveBorrowSavedItemT
  source: ArchiveBorrowRequestsSource
}) {
  const { t } = useTranslation('archive-borrow')
  const canOpen = item.status === 'ACTIVE'

  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium line-clamp-2">{item.reason}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <StickyNote className="size-3" aria-hidden />
          {item.noteCount}
        </span>
      </div>
      {item.lastFileName ? (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
          {item.lastFileName}
          {item.lastPage
            ? ` · ${t('reader.pageLabel', { page: item.lastPage })}`
            : ''}
        </p>
      ) : null}
      <div className="mt-3">
        {canOpen ? (
          <Button size="sm" variant="outline" asChild>
            <Link
              to="/app/archive-borrow/$borrowId/view"
              params={{ borrowId: item.requestId }}
              search={{
                from: source,
                ...(item.lastFileId
                  ? {
                      fileId: item.lastFileId,
                      page: item.lastPage ?? undefined,
                    }
                  : {}),
              }}
            >
              {t('reader.openSaved')}
            </Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('reader.savedExpiredHint')}
          </p>
        )}
      </div>
    </div>
  )
}

export function ArchiveBorrowReadingPage({
  source = 'warehouse',
}: {
  source?: ArchiveBorrowRequestsSource
}) {
  const { t } = useTranslation('archive-borrow')
  const summaryQuery = useQuery(archiveBorrowReadingSummaryQueryOptions())

  if (summaryQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">{t('page.readingTitle')}…</p>
    )
  }

  if (summaryQuery.error) {
    return (
      <p className="text-sm text-destructive">
        {translateError(summaryQuery.error) || t('errors.loadFailed')}
      </p>
    )
  }

  const currentlyReading = summaryQuery.data?.currentlyReading ?? []
  const saved = summaryQuery.data?.saved ?? []
  const isEmpty = currentlyReading.length === 0 && saved.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('page.readingTitle')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('page.readingDescription')}
        </p>
      </div>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">{t('reader.emptyReading')}</p>
      ) : null}

      {currentlyReading.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <BookMarked className="size-4 text-muted-foreground" aria-hidden />
            <h4 className="text-sm font-semibold">
              {t('reader.currentlyReading')}
            </h4>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {currentlyReading.map((item) => (
              <CurrentlyReadingCard
                key={`${item.requestId}-${item.fileId}`}
                item={item}
                source={source}
              />
            ))}
          </div>
        </section>
      ) : null}

      {saved.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <StickyNote className="size-4 text-muted-foreground" aria-hidden />
            <h4 className="text-sm font-semibold">{t('reader.saved')}</h4>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {saved.map((item) => (
              <SavedItemCard
                key={item.requestId}
                item={item}
                source={source}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
