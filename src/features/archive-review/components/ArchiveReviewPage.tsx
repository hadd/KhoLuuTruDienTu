import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { CheckCircle2, Eye, Inbox, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ArchiveReviewDetailSheet } from '@/features/archive-review/components/ArchiveReviewDetailSheet'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import {
  pendingArchiveSubmissionsQueryOptions,
  useApproveArchiveMutation,
  useRejectArchiveMutation,
} from '@/features/archive-submission/queries'
import type { ArchiveSubmissionT } from '@/features/archive-submission/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-review/')
const PREVIEW_FIELD_LIMIT = 3

function getPreviewChips(submission: ArchiveSubmissionT) {
  const fields = [...submission.fieldConfigSnapshot.fields]
    .filter(
      (field) => field.fieldType === 'SELECT' || field.fieldType === 'REFERENCE',
    )
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, PREVIEW_FIELD_LIMIT)

  return fields.map((field) => ({
    key: field.fieldKey,
    label: field.label,
    value: fieldDisplayValue(submission, field.fieldKey),
  }))
}

function fieldDisplayValue(
  submission: ArchiveSubmissionT,
  fieldKey: string,
): string {
  const labels = submission.fieldConfigSnapshot.resolvedLabels
  if (Object.hasOwn(labels, fieldKey)) {
    return labels[fieldKey].label
  }
  const raw = submission.fieldValues[fieldKey]
  if (raw === null || raw === undefined || raw === '') return '—'
  return String(raw)
}

export function ArchiveReviewPage() {
  const { t } = useTranslation('archive-review')
  const language = useCurrentLanguage()
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const { canReviewArchive } = useArchiveSubmissionAccess()
  const approveMutation = useApproveArchiveMutation()
  const rejectMutation = useRejectArchiveMutation()

  const [detailSubmission, setDetailSubmission] =
    useState<ArchiveSubmissionT | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ArchiveSubmissionT | null>(
    null,
  )
  const [rejectNotes, setRejectNotes] = useState('')

  const { data, isPending, isFetching } = useQuery(
    pendingArchiveSubmissionsQueryOptions({ page, limit }),
  )

  const items = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const pendingCount = data?.total ?? items.length

  const detailOpen = Boolean(detailSubmission)
  const rejectOpen = Boolean(rejectTarget)

  async function handleApprove(submission: ArchiveSubmissionT) {
    try {
      await approveMutation.mutateAsync(submission.id)
      toast.success(t('messages.approved'))
      if (detailSubmission?.id === submission.id) {
        setDetailSubmission(null)
      }
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  function openReject(submission: ArchiveSubmissionT) {
    setRejectTarget(submission)
    setRejectNotes('')
  }

  async function handleReject() {
    if (!rejectTarget) return
    const notes = rejectNotes.trim()
    if (!notes) {
      toast.error(t('reject.notesRequired'))
      return
    }

    try {
      await rejectMutation.mutateAsync({
        id: rejectTarget.id,
        payload: { rejectNotes: notes },
      })
      toast.success(t('messages.rejected'))
      if (detailSubmission?.id === rejectTarget.id) {
        setDetailSubmission(null)
      }
      setRejectTarget(null)
      setRejectNotes('')
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  if (!canReviewArchive) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('errors.noPermission')}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        {data ? (
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Inbox className="size-3.5" />
            {t('queue.count', { count: pendingCount })}
            {isFetching ? (
              <Loader2 className="size-3 animate-spin" />
            ) : null}
          </div>
        ) : null}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden" variant="list">
        {isPending && items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {!isPending && items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t('empty')}</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {t('emptyHint')}
            </p>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>{t('columns.dossier')}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t('columns.preview')}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('columns.submittedBy')}
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t('columns.submittedAt')}
                  </TableHead>
                  <TableHead className="w-[220px] text-right">
                    {t('columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((submission) => {
                  const chips = getPreviewChips(submission)
                  return (
                    <TableRow
                      key={submission.id}
                      className="cursor-pointer"
                      onClick={() => setDetailSubmission(submission)}
                    >
                      <TableCell>
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-medium leading-tight">
                            {submission.dossierName}
                          </p>
                          <p className="max-w-[280px] truncate font-mono text-xs text-muted-foreground">
                            {submission.folderPath}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex max-w-md flex-wrap gap-1.5">
                          {chips.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          ) : (
                            chips.map((chip) => (
                              <Badge
                                key={chip.key}
                                variant="secondary"
                                className="max-w-[160px] truncate font-normal"
                                title={`${chip.label}: ${chip.value}`}
                              >
                                {chip.value}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {submission.submitterName ?? submission.submittedBy}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap sm:table-cell text-sm text-muted-foreground">
                        {formatDate(submission.submittedAt, 'PP', language)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation()
                              setDetailSubmission(submission)
                            }}
                          >
                            <Eye className="mr-1 size-3.5" />
                            {t('actions.view')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              approveMutation.isPending ||
                              rejectMutation.isPending
                            }
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleApprove(submission)
                            }}
                          >
                            {approveMutation.isPending &&
                            approveMutation.variables === submission.id ? (
                              <Loader2 className="mr-1 size-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-1 size-3.5" />
                            )}
                            {t('actions.approve')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </Card>

      {items.length > 0 ? (
        <div className="mt-auto shrink-0">
          <ListPagePagination
            page={page}
            totalPages={totalPages}
            limit={limit}
            pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
            onPageChange={(nextPage) => {
              void navigate({
                search: (prev) => ({ ...prev, page: nextPage }),
                replace: true,
              })
            }}
            onLimitChange={(nextLimit) => {
              void navigate({
                search: (prev) => ({ ...prev, limit: nextLimit, page: 1 }),
                replace: true,
              })
            }}
          />
        </div>
      ) : null}

      <ArchiveReviewDetailSheet
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) setDetailSubmission(null)
        }}
        submission={detailSubmission}
        isApproving={approveMutation.isPending}
        isRejecting={rejectMutation.isPending}
        onApprove={(submission) => void handleApprove(submission)}
        onReject={openReject}
      />

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
            setRejectNotes('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reject.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="archive-reject-notes">{t('reject.notesLabel')}</Label>
            <Textarea
              id="archive-reject-notes"
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
              rows={4}
              placeholder={t('reject.notesPlaceholder')}
            />
            {rejectTarget ? (
              <p className="text-xs text-muted-foreground">
                {t('reject.forDossier', { name: rejectTarget.dossierName })}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectTarget(null)
                setRejectNotes('')
              }}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleReject()}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : null}
              {t('actions.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
