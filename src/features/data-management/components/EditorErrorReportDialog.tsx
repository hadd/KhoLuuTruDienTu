import { AlertTriangle } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EditorErrorReportTypeT } from '@/features/data-management/types'
import { editorErrorReportSubmitSchema } from '@/features/data-management/schemas'
import { FormField, useAppForm } from '@/lib/forms'

const ERROR_TYPE_OPTIONS: Array<EditorErrorReportTypeT> = [
  'cannot_open_file',
  'wrong_highlight',
  'other',
]

function EditorErrorReportForm({
  dossierId,
  dossierName,
  onCancel,
  onSubmitted,
  onSubmitReport,
}: {
  dossierId: string
  dossierName: string
  onCancel: () => void
  onSubmitted: () => void
  onSubmitReport: (input: {
    dossierId: string
    dossierName: string
    payload: {
      errorType: EditorErrorReportTypeT
      description: string
    }
  }) => Promise<void>
}) {
  const { t } = useTranslation('data-management')
  const form = useAppForm({
    schema: editorErrorReportSubmitSchema,
    defaultValues: {
      errorType: 'cannot_open_file' as EditorErrorReportTypeT,
      description: '',
    },
    onSubmit: async ({ value }) => {
      try {
        await onSubmitReport({
          dossierId,
          dossierName,
          payload: value,
        })
        toast.success(t('editorErrorReport.success.submit'))
        onSubmitted()
      } catch {
        toast.error(t('editorErrorReport.errors.submitFailed'))
      }
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="space-y-4"
    >
      <FormField
        form={form}
        name="errorType"
        label={t('editorErrorReport.form.errorType.label')}
        render={(field) => (
          <Select
            value={field.state.value}
            onValueChange={(value) =>
              field.handleChange(value as EditorErrorReportTypeT)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={t('editorErrorReport.form.errorType.label')}
              />
            </SelectTrigger>
            <SelectContent>
              {ERROR_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`editorErrorReport.form.errorType.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />

      <div className="grid gap-2">
        <FormField
          form={form}
          name="description"
          label={t('editorErrorReport.form.description.label')}
          as="textarea"
          placeholder={t('editorErrorReport.form.description.placeholder')}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('recordDetail.exportDialog.cancel')}
        </Button>
        <Button type="submit" className="gap-2">
          <AlertTriangle className="size-4" aria-hidden />
          {t('editorErrorReport.actions.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EditorErrorReportDialog({
  open,
  onOpenChange,
  dossierId,
  dossierName,
  onSubmitReport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string
  dossierName: string
  onSubmitReport: (input: {
    dossierId: string
    dossierName: string
    payload: {
      errorType: EditorErrorReportTypeT
      description: string
    }
  }) => Promise<void>
}) {
  const { t } = useTranslation('data-management')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('editorErrorReport.title')}</DialogTitle>
          <DialogDescription>{dossierName}</DialogDescription>
        </DialogHeader>
        <EditorErrorReportForm
          key={`${dossierId}-${open ? 'open' : 'closed'}`}
          dossierId={dossierId}
          dossierName={dossierName}
          onCancel={() => onOpenChange(false)}
          onSubmitted={() => onOpenChange(false)}
          onSubmitReport={onSubmitReport}
        />
      </DialogContent>
    </Dialog>
  )
}
