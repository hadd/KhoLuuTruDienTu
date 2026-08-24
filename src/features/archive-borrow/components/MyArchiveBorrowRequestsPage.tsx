import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Button } from '@/components/ui/button'
import { ArchiveBorrowCreateDialog } from '@/features/archive-borrow/components/ArchiveBorrowCreateDialog'
import {
  activateArchiveBorrowMutationOptions,
  archiveBorrowKeys,
  myArchiveBorrowRequestsQueryOptions,
  regenerateArchiveBorrowDipMutationOptions,
} from '@/features/archive-borrow/queries'
import { formatBorrowItemLabel } from '@/features/archive-borrow/lib/formatBorrowItemLabel'
import type { ArchiveBorrowRequestT } from '@/features/archive-borrow/types'
import { LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { translateError } from '@/lib/utils/translate-error'

const DEFAULT_MINE_PAGE_LIMIT = 10

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
      <td className="max-w-[16rem] px-3 py-2 text-sm">
        <span className="line-clamp-2 break-all [overflow-wrap:anywhere]" title={request.reason}>
          {request.reason}
        </span>
      </td>
      <td className="px-3 py-2 text-sm">
        <div className="space-y-1">
          <span>{t(`status.${request.status}` as const)}</span>
          {request.status === 'REJECTED' && request.reviewNotes ? (
            <p
              className="max-w-xs text-xs leading-snug text-destructive line-clamp-2 break-all [overflow-wrap:anywhere]"
              title={`${t('page.rejectNotes')}: ${request.reviewNotes}`}
            >
              {t('page.rejectNotes')}: {request.reviewNotes}
            </p>
          ) : null}
        </div>
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
      <td className="whitespace-nowrap px-3 py-2 text-sm">
        {formatTimeWindow(request)}
      </td>
      <td className="max-w-[22rem] px-3 py-2 text-sm">
        {request.items.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul
            className="space-y-0.5"
            title={request.items.map(formatBorrowItemLabel).join('\n')}
          >
            {request.items.map((item) => (
              <li key={item.id} className="truncate">
                {formatBorrowItemLabel(item)}
              </li>
            ))}
          </ul>
        )}
      </td>
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

export function MyArchiveBorrowRequestsPage({
  source = 'warehouse',
}: {
  source?: ArchiveBorrowRequestsSource
}) {
  const { t } = useTranslation('archive-borrow')
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_MINE_PAGE_LIMIT)

  const { data, isLoading, isFetching, error } = useQuery(
    myArchiveBorrowRequestsQueryOptions({
      page,
      limit,
      search: search || undefined,
    }),
  )

  function submitSearch() {
    setSearch(inputValue.trim())
    setPage(1)
  }

  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const showInitialLoading = isLoading && !data

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-1">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <ListPageSearchInput
          value={inputValue}
          onChange={setInputValue}
          onSearch={submitSearch}
          placeholder={t('page.searchMinePlaceholder')}
        />
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          {t('page.submitRequest')}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          {translateError(error) || t('errors.loadFailed')}
        </p>
      ) : showInitialLoading ? (
        <p className="text-sm text-muted-foreground">{t('page.myTitle')}…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('page.emptyMine')}</p>
      ) : (
        <div
          className={`min-h-0 flex-1 overflow-auto rounded-md border bg-card ${isFetching ? 'opacity-60' : ''}`}
        >
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-muted">
              <tr>
                <th className="px-3 py-2">{t('page.reason')}</th>
                <th className="px-3 py-2">{t('page.status')}</th>
                <th className="px-3 py-2">{t('page.dipStatus')}</th>
                <th className="px-3 py-2">{t('page.timeWindow')}</th>
                <th className="px-3 py-2">{t('page.borrowItems')}</th>
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

      {total > 0 ? (
        <div className="shrink-0">
          <ListPagePagination
            page={page}
            totalPages={totalPages}
            limit={limit}
            pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit)
              setPage(1)
            }}
          />
        </div>
      ) : null}

      <ArchiveBorrowCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
