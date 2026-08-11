import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Eye, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DateTimePicker } from '@/components/common/date/DateTimePicker'
import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  approveArchiveBorrowRequest,
  rejectArchiveBorrowRequest,
} from '@/features/archive-borrow/api/archiveBorrowClient'
import {
  archiveBorrowKeys,
  reviewArchiveBorrowRequestsQueryOptions,
} from '@/features/archive-borrow/queries'
import { formatBorrowItemLabel } from '@/features/archive-borrow/lib/formatBorrowItemLabel'
import type {
  ArchiveBorrowRequestT,
  ArchiveBorrowStatusT,
} from '@/features/archive-borrow/types'
import { LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { translateError } from '@/lib/utils/translate-error'

const DEFAULT_REVIEW_PAGE_LIMIT = 10
const REVIEW_STATUSES: Array<ArchiveBorrowStatusT> = [
  'PENDING',
  'ACTIVE',
  'REJECTED',
  'EXPIRED',
]

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatRange(from: string | null, until: string | null) {
  if (!from || !until) return '—'
  return `${new Date(from).toLocaleString()} → ${new Date(until).toLocaleString()}`
}

function formatTimeWindow(request: ArchiveBorrowRequestT) {
  if (request.status !== 'PENDING' && request.status !== 'REJECTED') {
    return formatRange(request.approvedFrom, request.approvedUntil)
  }
  return formatRange(request.requestedFrom, request.requestedUntil)
}

function borrowerLabel(request: ArchiveBorrowRequestT) {
  return (
    request.requester?.fullName ||
    request.requester?.email ||
    request.requesterId
  )
}

export function ArchiveBorrowApprovalPage() {
  const { t } = useTranslation('archive-borrow')
  const queryClient = useQueryClient()
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ArchiveBorrowStatusT>('PENDING')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_REVIEW_PAGE_LIMIT)
  const [approveTarget, setApproveTarget] = useState<ArchiveBorrowRequestT | null>(
    null,
  )
  const [approvedFrom, setApprovedFrom] = useState('')
  const [approvedUntil, setApprovedUntil] = useState('')
  const [rejectTarget, setRejectTarget] = useState<ArchiveBorrowRequestT | null>(
    null,
  )
  const [rejectNotes, setRejectNotes] = useState('')
  const [detailTarget, setDetailTarget] = useState<ArchiveBorrowRequestT | null>(
    null,
  )

  const queryParams = {
    page,
    limit,
    search: search || undefined,
    status: statusFilter,
  }

  const { data, isLoading, isFetching, error } = useQuery(
    reviewArchiveBorrowRequestsQueryOptions(queryParams),
  )

  const approveMutation = useMutation({
    mutationFn: (input: {
      id: string
      approvedFrom: string
      approvedUntil: string
    }) =>
      approveArchiveBorrowRequest(input.id, {
        approvedFrom: input.approvedFrom,
        approvedUntil: input.approvedUntil,
      }),
    onSuccess: () => {
      toast.success(t('page.approveSuccess'))
      setApproveTarget(null)
      void queryClient.invalidateQueries({ queryKey: archiveBorrowKeys.all })
    },
    onError: (err) => {
      toast.error(translateError(err) || t('errors.approveFailed'))
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (input: { id: string; reviewNotes: string }) =>
      rejectArchiveBorrowRequest(input.id, input.reviewNotes),
    onSuccess: () => {
      toast.success(t('page.reject'))
      setRejectTarget(null)
      setRejectNotes('')
      void queryClient.invalidateQueries({ queryKey: archiveBorrowKeys.all })
    },
    onError: (err) => {
      toast.error(translateError(err) || t('errors.rejectFailed'))
    },
  })

  function submitSearch() {
    setSearch(inputValue.trim())
    setPage(1)
  }

  function openApprove(request: ArchiveBorrowRequestT) {
    setApprovedFrom(toLocalInputValue(request.requestedFrom))
    setApprovedUntil(toLocalInputValue(request.requestedUntil))
    setApproveTarget(request)
  }

  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const showInitialLoading = isLoading && !data

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-1">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <ListPageSearchInput
            className="w-full sm:max-w-md"
            value={inputValue}
            onChange={setInputValue}
            onSearch={submitSearch}
            placeholder={t('page.searchReviewPlaceholder')}
          />
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as ArchiveBorrowStatusT)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder={t('page.status')} />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {t(`status.${status}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          {translateError(error) || t('errors.loadFailed')}
        </p>
      ) : showInitialLoading ? (
        <p className="text-sm text-muted-foreground">{t('page.reviewTitle')}…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('page.emptyReview')}</p>
      ) : (
        <div
          className={`min-h-0 flex-1 overflow-auto rounded-md border bg-card ${isFetching ? 'opacity-60' : ''}`}
        >
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-muted">
              <tr>
                <th className="px-3 py-2">{t('page.borrower')}</th>
                <th className="px-3 py-2">{t('page.reason')}</th>
                <th className="px-3 py-2">{t('page.borrowItems')}</th>
                <th className="px-3 py-2">{t('page.status')}</th>
                <th className="px-3 py-2">{t('page.timeWindow')}</th>
                <th className="px-3 py-2">{t('page.dipStatus')}</th>
                <th className="w-28 px-3 py-2 text-right">{t('page.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => {
                const isPending = request.status === 'PENDING'
                return (
                  <tr key={request.id} className="border-b align-top">
                    <td className="max-w-[12rem] px-3 py-2 text-sm">
                      <span className="block truncate" title={borrowerLabel(request)}>
                        {borrowerLabel(request)}
                      </span>
                    </td>
                    <td className="max-w-[14rem] px-3 py-2 text-sm">
                      <span
                        className="line-clamp-2 break-words"
                        title={request.reason}
                      >
                        {request.reason}
                      </span>
                    </td>
                    <td className="max-w-[18rem] px-3 py-2 text-sm">
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
                      <div className="space-y-1">
                        <span>{t(`status.${request.status}`)}</span>
                        {request.status === 'REJECTED' && request.reviewNotes ? (
                          <p
                            className="max-w-xs text-xs leading-snug text-destructive break-words"
                            title={request.reviewNotes}
                          >
                            {t('page.rejectNotes')}: {request.reviewNotes}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm">
                      {formatTimeWindow(request)}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {request.dipPackage
                        ? t(`dipStatus.${request.dipPackage.status}`)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="flex items-center justify-end gap-0.5">
                        {isPending ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() => openApprove(request)}
                              title={t('page.approve')}
                              aria-label={t('page.approve')}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                setRejectNotes('')
                                setRejectTarget(request)
                              }}
                              title={t('page.reject')}
                              aria-label={t('page.reject')}
                            >
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setDetailTarget(request)}
                          title={t('page.detail')}
                          aria-label={t('page.detail')}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
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

      <Dialog
        open={Boolean(approveTarget)}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('page.approveDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('page.approveFrom')}</Label>
              <DateTimePicker value={approvedFrom} onChange={setApprovedFrom} />
            </div>
            <div className="space-y-2">
              <Label>{t('page.approveUntil')}</Label>
              <DateTimePicker value={approvedUntil} onChange={setApprovedUntil} />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setApproveTarget(null)}
            >
              {t('page.rejectCancel')}
            </Button>
            <Button
              type="button"
              disabled={
                approveMutation.isPending || !approvedFrom || !approvedUntil
              }
              onClick={() => {
                if (!approveTarget) return
                approveMutation.mutate({
                  id: approveTarget.id,
                  approvedFrom: new Date(approvedFrom).toISOString(),
                  approvedUntil: new Date(approvedUntil).toISOString(),
                })
              }}
            >
              {approveMutation.isPending
                ? t('page.approving')
                : t('page.approveConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
            setRejectNotes('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('page.rejectDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="borrow-review-reject-notes">
              {t('page.rejectNotes')}
            </Label>
            <Textarea
              id="borrow-review-reject-notes"
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
              rows={4}
              placeholder={t('page.rejectNotesPlaceholder')}
              disabled={rejectMutation.isPending}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={rejectMutation.isPending}
              onClick={() => {
                setRejectTarget(null)
                setRejectNotes('')
              }}
            >
              {t('page.rejectCancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectMutation.isPending || !rejectNotes.trim()}
              onClick={() => {
                if (!rejectTarget) return
                rejectMutation.mutate({
                  id: rejectTarget.id,
                  reviewNotes: rejectNotes.trim(),
                })
              }}
            >
              {rejectMutation.isPending
                ? t('page.rejecting')
                : t('page.rejectConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(detailTarget)}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('page.detailTitle')}</DialogTitle>
          </DialogHeader>
          {detailTarget ? (
            <dl className="grid max-h-[min(70vh,36rem)] grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">
                  {t('page.borrower')}
                </dt>
                <dd className="mt-1 break-words text-sm">
                  {borrowerLabel(detailTarget)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">
                  {t('page.status')}
                </dt>
                <dd className="mt-1 text-sm">
                  {t(`status.${detailTarget.status}`)}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">
                  {t('page.reason')}
                </dt>
                <dd className="mt-1 break-words text-sm">{detailTarget.reason}</dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">
                  {t('page.borrowItems')}
                </dt>
                <dd className="mt-1 text-sm">
                  {detailTarget.items.length === 0 ? (
                    '—'
                  ) : (
                    <ul className="list-inside list-disc space-y-0.5">
                      {detailTarget.items.map((item) => (
                        <li key={item.id} className="break-words">
                          {formatBorrowItemLabel(item)}
                          {item.securityLevelName
                            ? ` (${t('page.securityLevel')}: ${item.securityLevelName})`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">
                  {t('page.timeWindow')}
                </dt>
                <dd className="mt-1 text-sm">{formatTimeWindow(detailTarget)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">
                  {t('page.dipStatus')}
                </dt>
                <dd className="mt-1 text-sm">
                  {detailTarget.dipPackage
                    ? t(`dipStatus.${detailTarget.dipPackage.status}`)
                    : '—'}
                </dd>
              </div>
              {detailTarget.status === 'REJECTED' && detailTarget.reviewNotes ? (
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground">
                    {t('page.rejectNotes')}
                  </dt>
                  <dd className="mt-1 break-words text-sm text-destructive">
                    {detailTarget.reviewNotes}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailTarget(null)}
            >
              {t('page.rejectCancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
