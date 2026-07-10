import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
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
import { Textarea } from '@/components/ui/textarea'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import {
  pendingArchiveSubmissionsQueryOptions,
  useApproveArchiveMutation,
  useRejectArchiveMutation,
} from '@/features/archive-submission/queries'
import type { ArchiveSubmissionT } from '@/features/archive-submission/types'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-review/')

export function ArchiveReviewPage() {
  const { t } = useTranslation('archive-review')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const { canReviewArchive } = useArchiveSubmissionAccess()
  const approveMutation = useApproveArchiveMutation()
  const rejectMutation = useRejectArchiveMutation()

  const [selectedSubmission, setSelectedSubmission] = useState<ArchiveSubmissionT | null>(
    null,
  )
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)

  const { data, isPending, isFetching } = useQuery(
    pendingArchiveSubmissionsQueryOptions({ page, limit }),
  )

  const items = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)

  async function handleApprove(submission: ArchiveSubmissionT) {
    try {
      await approveMutation.mutateAsync(submission.id)
      toast.success(t('messages.approved'))
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  async function handleReject() {
    if (!selectedSubmission) return
    const notes = rejectNotes.trim()
    if (!notes) {
      toast.error(t('reject.notesRequired'))
      return
    }

    try {
      await rejectMutation.mutateAsync({
        id: selectedSubmission.id,
        payload: { rejectNotes: notes },
      })
      toast.success(t('messages.rejected'))
      setRejectOpen(false)
      setRejectNotes('')
      setSelectedSubmission(null)
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {isPending && items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!isPending && items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t('empty')}
        </Card>
      ) : null}

      <div className="space-y-3 overflow-auto">
        {items.map((submission) => (
          <Card key={submission.id} className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{submission.dossierName}</p>
                <p className="text-xs text-muted-foreground">{submission.folderPath}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('submittedBy', {
                    name: submission.submitterName ?? submission.submittedBy,
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleApprove(submission)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  {t('actions.approve')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedSubmission(submission)
                    setRejectNotes('')
                    setRejectOpen(true)
                  }}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  {t('actions.reject')}
                </Button>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {submission.fieldConfigSnapshot.fields.map((field) => {
                const rawValue = submission.fieldValues[field.fieldKey]
                const resolved = submission.fieldConfigSnapshot.resolvedLabels[field.fieldKey]
                const displayValue = resolved?.label ?? String(rawValue ?? '—')
                return (
                  <div key={field.id} className="rounded-md border px-3 py-2">
                    <p className="text-xs text-muted-foreground">{field.label}</p>
                    <p className="text-sm">{displayValue}</p>
                  </div>
                )
              })}
            </div>
          </Card>
        ))}
      </div>

      {items.length > 0 ? (
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
      ) : null}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
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
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleReject()}
              disabled={rejectMutation.isPending}
            >
              {t('actions.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
