import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  documentTypeFormSchema,
  RETENTION_PERIOD_NONE,
  type DocumentTypeFormValues,
} from '@/features/document-type/schemas'
import {
  useCreateDocumentType,
  useUpdateDocumentType,
} from '@/features/document-type/queries'
import type { DocumentTypeT } from '@/features/document-type/types'
import { formatRetentionDurationLabel } from '@/features/retention-period/lib/formatRetentionDuration'
import { retentionPeriodsQueryOptions } from '@/features/retention-period/queries'
import { FormField, useAppForm } from '@/lib/forms'

const emptyValues: DocumentTypeFormValues = {
  id: '',
  name: '',
  description: '',
  retentionPeriodId: RETENTION_PERIOD_NONE,
}

function toFormValues(documentType: DocumentTypeT): DocumentTypeFormValues {
  return {
    id: documentType.id,
    name: documentType.name,
    description: documentType.description,
    retentionPeriodId: documentType.retentionPeriodId ?? RETENTION_PERIOD_NONE,
  }
}

function toPayload(value: DocumentTypeFormValues) {
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    retentionPeriodId:
      value.retentionPeriodId &&
      value.retentionPeriodId !== RETENTION_PERIOD_NONE
        ? value.retentionPeriodId
        : null,
  }
}

interface DocumentTypeFormProps {
  documentType: DocumentTypeT | null
  onClose: () => void
}

function DocumentTypeForm({ documentType, onClose }: DocumentTypeFormProps) {
  const { t } = useTranslation('document-type')
  const { t: tRetention } = useTranslation('retention-period')
  const createDocumentType = useCreateDocumentType()
  const updateDocumentType = useUpdateDocumentType()
  const isEdit = documentType !== null
  const isPending = createDocumentType.isPending || updateDocumentType.isPending

  const retentionQuery = useQuery(
    retentionPeriodsQueryOptions({ page: 1, limit: 200 }),
  )
  const retentionOptions = [
    { value: RETENTION_PERIOD_NONE, label: t('form.fields.retentionPeriod.none') },
    ...(retentionQuery.data?.items ?? []).map((item) => ({
      value: item.id,
      label: formatRetentionDurationLabel(item, tRetention),
    })),
  ]

  const form = useAppForm({
    schema: documentTypeFormSchema,
    defaultValues: documentType ? toFormValues(documentType) : emptyValues,
    onSubmit: async ({ value }) => {
      const payload = toPayload(value)
      if (isEdit && documentType) {
        const { id: _id, ...updatePayload } = payload
        await updateDocumentType.mutateAsync({
          id: documentType.id,
          payload: updatePayload,
        })
      } else {
        await createDocumentType.mutateAsync(payload)
      }
      onClose()
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          form={form}
          name="id"
          label={t('form.fields.id.label')}
          placeholder={t('form.fields.id.placeholder')}
          disabled={isEdit}
        />
        <FormField
          form={form}
          name="name"
          label={t('form.fields.name.label')}
          placeholder={t('form.fields.name.placeholder')}
        />
      </div>

      <FormField
        form={form}
        name="retentionPeriodId"
        label={t('form.fields.retentionPeriod.label')}
        placeholder={
          retentionQuery.isPending
            ? t('form.fields.retentionPeriod.loading')
            : retentionQuery.isError
              ? t('form.fields.retentionPeriod.loadFailed')
              : t('form.fields.retentionPeriod.placeholder')
        }
        as="select"
        options={retentionOptions}
        disabled={retentionQuery.isPending || retentionQuery.isError}
      />

      <FormField
        form={form}
        name="description"
        label={t('form.fields.description.label')}
        placeholder={t('form.fields.description.placeholder')}
        as="textarea"
      />

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          {t('form.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending
            ? t('form.actions.saving')
            : isEdit
              ? t('form.actions.update')
              : t('form.actions.create')}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface DocumentTypeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentType: DocumentTypeT | null
}

export function DocumentTypeFormDialog({
  open,
  onOpenChange,
  documentType,
}: DocumentTypeFormDialogProps) {
  const { t } = useTranslation('document-type')
  const isEdit = documentType !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('form.editTitle') : t('form.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {open ? (
          <DocumentTypeForm
            key={documentType?.id ?? 'create'}
            documentType={documentType}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
