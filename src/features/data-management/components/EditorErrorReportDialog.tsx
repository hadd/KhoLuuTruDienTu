import { AlertTriangle, FileText, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  editorErrorReportSubmitSchema,
  type EditorErrorReportSubmitForm,
} from '@/features/data-management/schemas'
import type {
  DataDossierMetadataT,
  DataTreeNodeT,
  EditorErrorReportTypeT,
} from '@/features/data-management/types'
import { FormField, useAppForm } from '@/lib/forms'

const ERROR_TYPE_OPTIONS: Array<EditorErrorReportTypeT> = [
  'cannot_open_file',
  'wrong_highlight',
  'other',
]

const ALL_DOSSIER_VALUE = '__all__'

function getFieldDisplayLabel(
  fieldKey: string,
  metadata?: DataDossierMetadataT | null,
): string {
  if (!metadata?.metadata_groups?.length) return fieldKey

  const parts = fieldKey.split('.')
  const fieldName = parts.length > 1 ? parts[parts.length - 1] : fieldKey

  for (const group of metadata.metadata_groups) {
    for (const field of group.fields) {
      if (field.name === fieldName) {
        const groupTitle =
          group.source_document?.file_name?.trim() ||
          group.group_name?.trim() ||
          group.group_code
        return `${groupTitle} → ${field.display?.trim() || field.name}`
      }
    }
  }
  return fieldKey
}

function EditorErrorReportForm({
  dossierId,
  dossierName,
  metadata,
  documents = [],
  activeDocumentId,
  initialSelectedFields = [],
  onCancel,
  onSubmitted,
  onSubmitReport,
}: {
  dossierId: string
  dossierName: string
  metadata: DataDossierMetadataT
  documents?: Array<DataTreeNodeT>
  activeDocumentId?: string | null
  initialSelectedFields?: Array<string>
  onCancel: () => void
  onSubmitted: () => void
  onSubmitReport: (input: {
    dossierId: string
    dossierName: string
    metadata: DataDossierMetadataT
    payload: EditorErrorReportSubmitForm
  }) => Promise<void>
}) {
  const { t } = useTranslation('data-management')

  const defaultDoc = activeDocumentId
    ? documents.find((doc) => doc.id === activeDocumentId)
    : undefined

  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    defaultDoc?.id ?? null,
  )
  const [selectedFileName, setSelectedFileName] = useState<string | null>(
    defaultDoc?.name ?? null,
  )
  const [errorFields, setErrorFields] = useState<Array<string>>(
    initialSelectedFields,
  )

  const form = useAppForm({
    schema: editorErrorReportSubmitSchema,
    defaultValues: {
      errorType: 'cannot_open_file' as EditorErrorReportTypeT,
      description: '',
      fileId: defaultDoc?.id ?? null,
      fileName: defaultDoc?.name ?? null,
      fields: initialSelectedFields,
    },
    onSubmit: async ({ value }) => {
      try {
        await onSubmitReport({
          dossierId,
          dossierName,
          metadata,
          payload: {
            ...value,
            fileId: selectedFileId,
            fileName: selectedFileName,
            fields: errorFields,
          },
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

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t('editorErrorReport.form.file.label', 'Tệp tin liên quan')}
        </Label>
        <Select
          value={selectedFileId ?? ALL_DOSSIER_VALUE}
          onValueChange={(value) => {
            if (value === ALL_DOSSIER_VALUE) {
              setSelectedFileId(null)
              setSelectedFileName(null)
            } else {
              const targetDoc = documents.find((doc) => doc.id === value)
              setSelectedFileId(value)
              setSelectedFileName(targetDoc?.name ?? null)
            }
          }}
        >
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2 truncate">
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue
                placeholder={t(
                  'editorErrorReport.form.file.placeholder',
                  'Chọn tệp tin (hoặc toàn bộ hồ sơ)',
                )}
              />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DOSSIER_VALUE}>
              {t('editorErrorReport.form.file.allDossier', 'Toàn bộ hồ sơ')}
            </SelectItem>
            {documents.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t('editorErrorReport.form.fields.label', 'Trường dữ liệu báo lỗi')}
          {errorFields.length > 0 ? ` (${errorFields.length})` : ''}
        </Label>
        {errorFields.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            {t(
              'editorErrorReport.form.fields.noFields',
              'Chưa chọn trường nào (có thể chọn trực tiếp bằng checkbox trên form dữ liệu)',
            )}
          </p>
        ) : (
          <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border p-2">
            {errorFields.map((key) => (
              <Badge
                key={key}
                variant="secondary"
                className="gap-1 border border-destructive/20 bg-destructive/10 text-xs font-normal text-destructive hover:bg-destructive/15"
              >
                <span className="truncate max-w-[280px]">
                  {getFieldDisplayLabel(key, metadata)}
                </span>
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20"
                  onClick={() => {
                    setErrorFields((prev) => prev.filter((k) => k !== key))
                  }}
                  aria-label={t('editorErrorReport.form.fields.removeField', {
                    name: key,
                    defaultValue: `Bỏ chọn trường ${key}`,
                  })}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

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
  metadata,
  documents = [],
  activeDocumentId,
  initialSelectedFields = [],
  onSubmitReport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string
  dossierName: string
  metadata: DataDossierMetadataT
  documents?: Array<DataTreeNodeT>
  activeDocumentId?: string | null
  initialSelectedFields?: Array<string>
  onSubmitReport: (input: {
    dossierId: string
    dossierName: string
    metadata: DataDossierMetadataT
    payload: EditorErrorReportSubmitForm
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
          key={`${dossierId}-${open ? 'open' : 'closed'}-${initialSelectedFields.join(',')}`}
          dossierId={dossierId}
          dossierName={dossierName}
          metadata={metadata}
          documents={documents}
          activeDocumentId={activeDocumentId}
          initialSelectedFields={initialSelectedFields}
          onCancel={() => onOpenChange(false)}
          onSubmitted={() => onOpenChange(false)}
          onSubmitReport={onSubmitReport}
        />
      </DialogContent>
    </Dialog>
  )
}
