import { Loader2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  getIssueReportStatusLabelKey,
  getIssueReportTypeLabel,
} from '@/features/data-management/lib/editorErrorReportHelpers'
import type { EditorErrorReportT } from '@/features/data-management/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils/cn'

function IssueReportReviewCard({
  report,
  index,
  total,
  canConfirm,
  canReject,
  canForward,
  isActionPending,
  onConfirm,
  onReject,
  onForward,
}: {
  report: EditorErrorReportT
  index: number
  total: number
  canConfirm: boolean
  canReject: boolean
  canForward: boolean
  isActionPending: boolean
  onConfirm: (report: EditorErrorReportT) => Promise<void>
  onReject: (report: EditorErrorReportT, rejectNote: string) => Promise<void>
  onForward: (report: EditorErrorReportT) => Promise<void>
}) {
  const { t } = useTranslation('data-management')
  const language = useCurrentLanguage()
  const [isRejectStep, setIsRejectStep] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [isPending, setIsPending] = useState(false)

  const reportedAtLabel = formatDate(report.reportedAt, 'PPp', language)
  const resolvedAtLabel = report.reviewedAt
    ? formatDate(report.reviewedAt, 'PPp', language)
    : null
  const isBusy = isPending || isActionPending
  const canAct = canConfirm || canReject || canForward
  const statusLabelKey = getIssueReportStatusLabelKey(report.status)

  function resetRejectStep() {
    setIsRejectStep(false)
    setRejectNote('')
  }

  async function handleConfirm() {
    setIsPending(true)
    try {
      await onConfirm(report)
      toast.success(t('editorErrorReport.success.confirm'))
      resetRejectStep()
    } catch {
      toast.error(t('editorErrorReport.errors.actionFailed'))
    } finally {
      setIsPending(false)
    }
  }

  async function handleRejectConfirm() {
    const trimmed = rejectNote.trim()
    if (!trimmed) return

    setIsPending(true)
    try {
      await onReject(report, trimmed)
      toast.success(t('editorErrorReport.success.reject'))
      resetRejectStep()
    } catch {
      toast.error(t('editorErrorReport.errors.actionFailed'))
    } finally {
      setIsPending(false)
    }
  }

  async function handleForward() {
    setIsPending(true)
    try {
      await onForward(report)
      toast.success(t('editorErrorReport.success.forward'))
      resetRejectStep()
    } catch {
      toast.error(t('editorErrorReport.errors.actionFailed'))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        !canAct && 'bg-muted/40 opacity-60',
      )}
    >
      {total > 1 ? (
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          {t('editorErrorReport.review.reportIndex', {
            index: index + 1,
            total,
          })}
        </p>
      ) : null}

      {!canAct && statusLabelKey ? (
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          {t(statusLabelKey)}
        </p>
      ) : null}

      <div className="space-y-3">
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">
            {t('editorErrorReport.form.errorType.label')}
          </p>
          <p className="text-sm text-foreground">
            {getIssueReportTypeLabel(report, t)}
          </p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">
            {t('editorErrorReport.form.description.label')}
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {report.description}
          </p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">
            {t('editorErrorReport.review.reporter')}
          </p>
          <p className="text-sm text-foreground">{report.reporterName}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">
            {t('editorErrorReport.review.reportedAt')}
          </p>
          <p className="text-sm text-foreground">{reportedAtLabel}</p>
        </div>
        {resolvedAtLabel ? (
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">
              {t('editorErrorReport.review.resolvedAt')}
            </p>
            <p className="text-sm text-foreground">{resolvedAtLabel}</p>
          </div>
        ) : null}

        {canAct && isRejectStep ? (
          <div className="grid gap-2 border-t border-border pt-3">
            <Label htmlFor={`editor-error-report-reject-note-${report.id}`}>
              {t('editorErrorReport.review.actions.rejectNote')}
            </Label>
            <Textarea
              id={`editor-error-report-reject-note-${report.id}`}
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              placeholder={t('editorErrorReport.review.rejectNotePlaceholder')}
              disabled={isBusy}
              rows={3}
            />
          </div>
        ) : null}
      </div>

      {canAct ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {isRejectStep ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetRejectStep}
                disabled={isBusy}
              >
                {t('recordDetail.exportDialog.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => void handleRejectConfirm()}
                disabled={isBusy || !rejectNote.trim()}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <XCircle className="size-4" aria-hidden />
                )}
                {t('editorErrorReport.review.actions.reject')}
              </Button>
            </>
          ) : (
            <>
              {canReject ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRejectStep(true)}
                  disabled={isBusy}
                >
                  {t('editorErrorReport.review.actions.reject')}
                </Button>
              ) : null}
              {canForward ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleForward()}
                  disabled={isBusy}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  {t('editorErrorReport.review.actions.forward')}
                </Button>
              ) : null}
              {canConfirm ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleConfirm()}
                  disabled={isBusy}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  {t('editorErrorReport.review.actions.confirm')}
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function EditorErrorReportReviewDialog({
  open,
  onOpenChange,
  dossierName,
  reports,
  canActOnReport,
  canForward,
  isActionPending = false,
  onConfirm,
  onReject,
  onForward,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierName: string
  reports: Array<EditorErrorReportT>
  canActOnReport: (report: EditorErrorReportT) => boolean
  canForward: (report: EditorErrorReportT) => boolean
  isActionPending?: boolean
  onConfirm: (report: EditorErrorReportT) => Promise<void>
  onReject: (
    report: EditorErrorReportT,
    rejectNote: string,
  ) => Promise<void>
  onForward: (report: EditorErrorReportT) => Promise<void>
}) {
  const { t } = useTranslation('data-management')

  if (reports.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[85vh] flex-col',
          reports.length > 1 ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <DialogHeader>
          <DialogTitle>
            {reports.length > 1
              ? t('editorErrorReport.review.multipleTitle')
              : t('editorErrorReport.review.title')}
          </DialogTitle>
          <DialogDescription>{dossierName}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto py-2">
          {reports.map((report, index) => (
            <IssueReportReviewCard
              key={report.id}
              report={report}
              index={index}
              total={reports.length}
              canConfirm={canActOnReport(report)}
              canReject={canActOnReport(report)}
              canForward={canForward(report)}
              isActionPending={isActionPending}
              onConfirm={onConfirm}
              onReject={onReject}
              onForward={onForward}
            />
          ))}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isActionPending}
          >
            {t('recordDetail.exportDialog.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
