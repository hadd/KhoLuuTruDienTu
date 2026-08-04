import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ArchiveBorrowCreateDialog } from '@/features/archive-borrow/components/ArchiveBorrowCreateDialog'
import {
  activateArchiveBorrowMutationOptions,
  archiveBorrowKeys,
  myArchiveBorrowRequestsQueryOptions,
  regenerateArchiveBorrowDipMutationOptions,
} from '@/features/archive-borrow/queries'
import type { ArchiveBorrowRequestT } from '@/features/archive-borrow/types'
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

function RequestRow({
  request,
  onChanged,
}: {
  request: ArchiveBorrowRequestT
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
  const canActivate = request.status === 'APPROVED' && dipReady
  const canView = request.status === 'ACTIVE'
  const showRegenerate =
    request.status === 'APPROVED' &&
    (dipFailed || dipStatus === 'PENDING')

  return (
    <tr className="border-b align-top">
      <td className="px-3 py-2 text-sm">
        {request.reason}
      </td>
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

export function MyArchiveBorrowRequestsPage() {
  const { t } = useTranslation('archive-borrow')
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const { data, isLoading, error } = useQuery(myArchiveBorrowRequestsQueryOptions())

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
