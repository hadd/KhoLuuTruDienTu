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
import { getErrorTypeLabelKey } from '@/features/data-management/lib/editorErrorReportHelpers'
import type { EditorErrorReportT } from '@/features/data-management/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate } from '@/lib/utils/date'

export function EditorErrorReportReviewDialog({
  open,
  onOpenChange,
  report,
  canConfirm,
  canReject,
  canForward,
  onConfirm,
  onReject,
  onForward,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: EditorErrorReportT | null
  canConfirm: boolean
  canReject: boolean
  canForward: boolean
  onConfirm: (report: EditorErrorReportT) => Promise<void>
  onReject: (
    report: EditorErrorReportT,
    rejectNote: string,
  ) => Promise<void>
  onForward: (report: EditorErrorReportT) => Promise<void>
}) {
  const { t } = useTranslation('data-management')
  const language = useCurrentLanguage()
  const [isRejectStep, setIsRejectStep] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [isPending, setIsPending] = useState(false)

  if (!report) return null

  const reportedAtLabel = formatDate(report.reportedAt, 'PPp', language)

  function resetRejectStep() {
    setIsRejectStep(false)
    setRejectNote('')
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) return
    if (!nextOpen) {
      resetRejectStep()
    }
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    setIsPending(true)
    try {
      await onConfirm(report)
      toast.success(t('editorErrorReport.success.confirm'))
      handleOpenChange(false)
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
      handleOpenChange(false)
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
      handleOpenChange(false)
    } catch {
      toast.error(t('editorErrorReport.errors.actionFailed'))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('editorErrorReport.review.title')}</DialogTitle>
          <DialogDescription>{report.dossierName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">
              {t('editorErrorReport.form.errorType.label')}
            </p>
            <p className="text-sm text-foreground">
              {t(getErrorTypeLabelKey(report.errorType))}
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

          {isRejectStep ? (
            <div className="grid gap-2 border-t border-border pt-3">
              <Label htmlFor="editor-error-report-reject-note">
                {t('editorErrorReport.review.actions.rejectNote')}
              </Label>
              <Textarea
                id="editor-error-report-reject-note"
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
                placeholder={t('editorErrorReport.review.rejectNotePlaceholder')}
                disabled={isPending}
                rows={3}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          {isRejectStep ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={resetRejectStep}
                disabled={isPending}
              >
                {t('recordDetail.exportDialog.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                onClick={() => void handleRejectConfirm()}
                disabled={isPending || !rejectNote.trim()}
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
                  onClick={() => setIsRejectStep(true)}
                  disabled={isPending}
                >
                  {t('editorErrorReport.review.actions.reject')}
                </Button>
              ) : null}
              {canForward ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleForward()}
                  disabled={isPending}
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
                  onClick={() => void handleConfirm()}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  {t('editorErrorReport.review.actions.confirm')}
                </Button>
              ) : null}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
