import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AdminIssueReportT } from '@/features/project-manager/types'
import { closeIssueReportSchema } from '@/features/project-manager/schemas'
import { useCloseIssueReportMutation } from '@/features/project-manager/queries'
import { FormField, useAppForm } from '@/lib/forms'

interface CloseIssueReportDialogProps {
  report: AdminIssueReportT | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CloseIssueReportForm({
  report,
  onCancel,
  onSuccess,
}: {
  report: AdminIssueReportT
  onCancel: () => void
  onSuccess: () => void
}) {
  const { t } = useTranslation('project-manager')
  const closeMutation = useCloseIssueReportMutation()

  const form = useAppForm({
    schema: closeIssueReportSchema,
    defaultValues: { notes: '' },
    onSubmit: async ({ value }) => {
      await closeMutation.mutateAsync({
        reportId: report.id,
        payload: value,
      })
      onSuccess()
    },
  })

  const isPending = closeMutation.isPending

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <div className="space-y-4 py-2">
        <FormField
          form={form}
          name="notes"
          label={t('issueReports.close.fields.notes.label')}
          as="textarea"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {t('issueReports.close.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('issueReports.close.actions.submitting')}
            </>
          ) : (
            t('issueReports.close.actions.submit')
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CloseIssueReportDialog({
  report,
  open,
  onOpenChange,
}: CloseIssueReportDialogProps) {
  const { t } = useTranslation('project-manager')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('issueReports.close.title')}</DialogTitle>
          <DialogDescription>
            {report
              ? t('issueReports.close.description', {
                  dossierName: report.dossierName ?? report.dossierId,
                  type: report.type,
                })
              : null}
          </DialogDescription>
        </DialogHeader>
        {report ? (
          <CloseIssueReportForm
            key={report.id}
            report={report}
            onCancel={() => onOpenChange(false)}
            onSuccess={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
