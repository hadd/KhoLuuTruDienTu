import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DateTimePicker } from '@/components/common/date/DateTimePicker'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  approveArchiveBorrowMutationOptions,
  archiveBorrowKeys,
  pendingArchiveBorrowRequestsQueryOptions,
  rejectArchiveBorrowMutationOptions,
} from '@/features/archive-borrow/queries'
import type { ArchiveBorrowRequestT } from '@/features/archive-borrow/types'
import { translateError } from '@/lib/utils/translate-error'

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatBorrowItemLabel(item: ArchiveBorrowRequestT['items'][number]): string {
  const dossierName = item.dossierName?.trim() || item.dossierId
  if (item.itemKind === 'FILE') {
    const fileName = item.fileName?.trim()
    return fileName ? `${dossierName} / ${fileName}` : dossierName
  }
  if (item.itemKind === 'DOSSIER' && item.fileCount != null) {
    return `${dossierName} (${item.fileCount})`
  }
  return dossierName
}

function ReviewRow({
  request,
  onChanged,
}: {
  request: ArchiveBorrowRequestT
  onChanged: () => void
}) {
  const { t } = useTranslation('archive-borrow')
  const [approvedFrom, setApprovedFrom] = useState(
    toLocalInputValue(request.requestedFrom),
  )
  const [approvedUntil, setApprovedUntil] = useState(
    toLocalInputValue(request.requestedUntil),
  )
  const [rejectNotes, setRejectNotes] = useState('')

  const approveMutation = useMutation({
    ...approveArchiveBorrowMutationOptions(request.id),
    onSuccess: () => {
      toast.success(t('page.approveSuccess'))
      onChanged()
    },
    onError: (error) => {
      toast.error(translateError(error) || t('errors.approveFailed'))
    },
  })

  const rejectMutation = useMutation({
    ...rejectArchiveBorrowMutationOptions(request.id),
    onSuccess: () => {
      toast.success(t('page.reject'))
      onChanged()
    },
    onError: (error) => {
      toast.error(translateError(error) || t('errors.rejectFailed'))
    },
  })

  const borrowerName =
    request.requester?.fullName ||
    request.requester?.email ||
    request.requesterId

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-medium">
            {t('page.reason')}: {request.reason}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('page.borrower')}: {borrowerName}
          </p>
          <div className="space-y-1 pt-1">
            <p className="text-xs text-muted-foreground">{t('page.borrowItems')}</p>
            {request.items.length === 0 ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : (
              <ul className="list-inside list-disc text-sm">
                {request.items.map((item) => (
                  <li key={item.id}>{formatBorrowItemLabel(item)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t(`status.${request.status}` as const)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>{t('page.approveFrom')}</span>
          <DateTimePicker value={approvedFrom} onChange={setApprovedFrom} />
        </label>
        <label className="space-y-1 text-sm">
          <span>{t('page.approveUntil')}</span>
          <DateTimePicker value={approvedUntil} onChange={setApprovedUntil} />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span>{t('page.rejectNotes')}</span>
        <Textarea
          value={rejectNotes}
          onChange={(e) => setRejectNotes(e.target.value)}
          rows={2}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={approveMutation.isPending || !approvedFrom || !approvedUntil}
          onClick={() =>
            approveMutation.mutate({
              approvedFrom: new Date(approvedFrom).toISOString(),
              approvedUntil: new Date(approvedUntil).toISOString(),
            })
          }
        >
          {approveMutation.isPending ? t('page.approving') : t('page.approve')}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={rejectMutation.isPending || !rejectNotes.trim()}
          onClick={() => rejectMutation.mutate(rejectNotes.trim())}
        >
          {rejectMutation.isPending ? t('page.rejecting') : t('page.reject')}
        </Button>
      </div>
    </div>
  )
}

export function ArchiveBorrowApprovalPage() {
  const { t } = useTranslation('archive-borrow')
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery(
    pendingArchiveBorrowRequestsQueryOptions(),
  )

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('page.reviewTitle')}…</p>
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {translateError(error) || t('errors.loadFailed')}
      </p>
    )
  }

  const rows = data ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('page.reviewTitle')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('page.reviewDescription')}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('page.emptyPending')}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((request) => (
            <ReviewRow
              key={request.id}
              request={request}
              onChanged={() => {
                void queryClient.invalidateQueries({
                  queryKey: archiveBorrowKeys.all,
                })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
