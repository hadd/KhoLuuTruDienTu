import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
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
  useCreateDocumentType,
  useUpdateDocumentType,
} from '@/features/document-type/queries'
import {
  documentTypeFormSchema,
  RETENTION_PERIOD_NONE,
  type DocumentTypeFormValues,
} from '@/features/document-type/schemas'
import type { DocumentTypeT } from '@/features/document-type/types'
import { formatRetentionDurationLabel } from '@/features/retention-period/lib/formatRetentionDuration'
import { activeRetentionPeriodsQueryOptions } from '@/features/retention-period/queries'
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
    retentionPeriodId:
      documentType.retentionPeriodId ?? RETENTION_PERIOD_NONE,
  }
}

function toRetentionPeriodId(
  value: string | undefined,
): string | null {
  if (!value || value === RETENTION_PERIOD_NONE) return null
  return value
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
  const isPending =
    createDocumentType.isPending || updateDocumentType.isPending

  const { data: retentionData } = useQuery(activeRetentionPeriodsQueryOptions())
  const retentionItems = retentionData?.items ?? []
  const retentionOptions = useMemo(() => {
    const options = [
      {
        value: RETENTION_PERIOD_NONE,
        label: t('form.fields.retentionPeriod.none'),
      },
      ...retentionItems.map((period) => ({
        value: period.id,
        label: formatRetentionDurationLabel(period, tRetention),
      })),
    ]

    const currentId = documentType?.retentionPeriodId
    if (
      currentId &&
      !options.some((option) => option.value === currentId)
    ) {
      options.push({
        value: currentId,
        label: currentId,
      })
    }

    return options
  }, [documentType?.retentionPeriodId, retentionItems, t, tRetention])

  const form = useAppForm({
    schema: documentTypeFormSchema,
    defaultValues: documentType ? toFormValues(documentType) : emptyValues,
    onSubmit: async ({ value }) => {
      const retentionPeriodId = toRetentionPeriodId(value.retentionPeriodId)
      if (isEdit && documentType) {
        await updateDocumentType.mutateAsync({
          id: documentType.id,
          payload: {
            name: value.name,
            description: value.description,
            retentionPeriodId,
          },
        })
      } else {
        await createDocumentType.mutateAsync({
          id: value.id,
          name: value.name,
          description: value.description,
          retentionPeriodId,
        })
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
        placeholder={t('form.fields.retentionPeriod.placeholder')}
        as="select"
        options={retentionOptions}
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
