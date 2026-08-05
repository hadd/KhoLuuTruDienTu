import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { BookMarked, Bookmark, StickyNote } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ArchiveBorrowCreateDialog } from '@/features/archive-borrow/components/ArchiveBorrowCreateDialog'
import {
  activateArchiveBorrowMutationOptions,
  archiveBorrowKeys,
  archiveBorrowReadingSummaryQueryOptions,
  myArchiveBorrowRequestsQueryOptions,
  regenerateArchiveBorrowDipMutationOptions,
} from '@/features/archive-borrow/queries'
import type {
  ArchiveBorrowCurrentlyReadingT,
  ArchiveBorrowRequestT,
  ArchiveBorrowSavedItemT,
} from '@/features/archive-borrow/types'
import { translateError } from '@/lib/utils/translate-error'

function formatRange(from: string | null, until: string | null) {
  if (!from || !until) return '—'
  return `${new Date(from).toLocaleString()} → ${new Date(until).toLocaleString()}`
}

function isApprovedStatus(status: ArchiveBorrowRequestT['status']) {
  return status !== 'PENDING' && status !== 'REJECTED'
}

function formatTimeWindow(request: ArchiveBorrowRequestT) {
  if (isApprovedStatus(request.status)) {
    return formatRange(request.approvedFrom, request.approvedUntil)
  }
  return formatRange(request.requestedFrom, request.requestedUntil)
}

export type ArchiveBorrowRequestsSource = 'library' | 'warehouse'

function RequestRow({
  request,
  source,
  onChanged,
}: {
  request: ArchiveBorrowRequestT
  source: ArchiveBorrowRequestsSource
  onChanged: () => void
}) {
  const { t } = useTranslation('archive-borrow')
  const activateMutation = useMutation({
    ...activateArchiveBorrowMutationOptions(request.id),
    onSuccess: () => {
      toast.success(t('page.activate'))
      onChanged()
    },
    onError: (error) => {
      toast.error(translateError(error) || t('errors.activateFailed'))
    },
  })

  const regenerateMutation = useMutation({
    ...regenerateArchiveBorrowDipMutationOptions(request.id),
    onSuccess: (result) => {
      if (result.dipPackage?.status === 'READY') {
        toast.success(t('page.regenerateDipSuccess'))
      } else {
        toast.error(
          result.dipPackage?.errorMessage || t('errors.regenerateDipFailed'),
        )
      }
      onChanged()
    },
    onError: (error) => {
      toast.error(translateError(error) || t('errors.regenerateDipFailed'))
    },
  })

  const dipStatus = request.dipPackage?.status
  const dipReady = dipStatus === 'READY'
  const dipFailed = dipStatus === 'FAILED'

  const now = new Date()
  const windowNotStarted =
    request.status === 'APPROVED' &&
    !!request.approvedFrom &&
    now < new Date(request.approvedFrom)

  const canActivate = request.status === 'APPROVED' && dipReady && !windowNotStarted
  const canView = request.status === 'ACTIVE'
  const showRegenerate =
    request.status === 'APPROVED' &&
    (dipFailed || dipStatus === 'PENDING')

  return (
    <tr className="border-b align-top">
      <td className="px-3 py-2 text-sm">{request.reason}</td>
      <td className="px-3 py-2 text-sm">
        {t(`status.${request.status}` as const)}
      </td>
      <td className="px-3 py-2 text-sm">
        <div className="space-y-1">
          <span>
            {request.dipPackage
              ? t(`dipStatus.${request.dipPackage.status}` as const)
              : '—'}
          </span>
          {dipFailed && request.dipPackage?.errorMessage ? (
            <p
              className="max-w-xs text-xs text-destructive"
              title={request.dipPackage.errorMessage}
            >
              {request.dipPackage.errorMessage}
            </p>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2 text-sm">{formatTimeWindow(request)}</td>
      <td className="px-3 py-2 text-sm">{request.items.length}</td>
      <td className="px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          {canActivate ? (
            <Button
              size="sm"
              disabled={activateMutation.isPending}
              onClick={() => activateMutation.mutate()}
            >
              {activateMutation.isPending
                ? t('page.activating')
                : t('page.activate')}
            </Button>
          ) : null}
          {canView ? (
            <Button size="sm" variant="outline" asChild>
              <Link
                to="/app/archive-borrow/$borrowId/view"
                params={{ borrowId: request.id }}
                search={{ from: source }}
              >
                {t('page.view')}
              </Link>
            </Button>
          ) : null}
          {showRegenerate ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={regenerateMutation.isPending}
              onClick={() => regenerateMutation.mutate()}
            >
              {regenerateMutation.isPending
                ? t('page.regeneratingDip')
                : t('page.regenerateDip')}
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

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
          <Bookmark className="size-3" aria-hidden />
          {item.bookmarkCount}
        </span>
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

export function MyArchiveBorrowRequestsPage({
  source = 'warehouse',
}: {
  source?: ArchiveBorrowRequestsSource
}) {
  const { t } = useTranslation('archive-borrow')
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const { data, isLoading, error } = useQuery(myArchiveBorrowRequestsQueryOptions())
  const summaryQuery = useQuery(archiveBorrowReadingSummaryQueryOptions())

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('page.myTitle')}…</p>
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {translateError(error) || t('errors.loadFailed')}
      </p>
    )
  }

  const rows = data ?? []
  const currentlyReading = summaryQuery.data?.currentlyReading ?? []
  const saved = summaryQuery.data?.saved ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{t('page.myTitle')}</h3>
          <p className="text-sm text-muted-foreground">{t('page.myDescription')}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          {t('page.submitRequest')}
        </Button>
      </div>

      {currentlyReading.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <BookMarked className="size-4 text-muted-foreground" aria-hidden />
            <h4 className="text-sm font-semibold">{t('reader.currentlyReading')}</h4>
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
            <Bookmark className="size-4 text-muted-foreground" aria-hidden />
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

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('page.emptyMine')}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-left">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t('page.reason')}</th>
                <th className="px-3 py-2">{t('page.status')}</th>
                <th className="px-3 py-2">{t('page.dipStatus')}</th>
                <th className="px-3 py-2">{t('page.timeWindow')}</th>
                <th className="px-3 py-2">{t('page.items')}</th>
                <th className="px-3 py-2">{t('page.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  source={source}
                  onChanged={() => {
                    void queryClient.invalidateQueries({
                      queryKey: archiveBorrowKeys.all,
                    })
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ArchiveBorrowCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
