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
  retentionPeriodFormSchema,
  type RetentionPeriodFormValues,
} from '@/features/retention-period/schemas'
import {
  useCreateRetentionPeriod,
  useUpdateRetentionPeriod,
} from '@/features/retention-period/queries'
import type { RetentionPeriodT } from '@/features/retention-period/types'
import { FormField, useAppForm } from '@/lib/forms'

const emptyValues: RetentionPeriodFormValues = {
  id: '',
  name: '',
  description: '',
}

function toFormValues(period: RetentionPeriodT): RetentionPeriodFormValues {
  return {
    id: period.id,
    name: period.name,
    description: period.description,
  }
}

interface RetentionPeriodFormProps {
  period: RetentionPeriodT | null
  onClose: () => void
}

function RetentionPeriodForm({ period, onClose }: RetentionPeriodFormProps) {
  const { t } = useTranslation('retention-period')
  const createPeriod = useCreateRetentionPeriod()
  const updatePeriod = useUpdateRetentionPeriod()
  const isEdit = period !== null
  const isPending = createPeriod.isPending || updatePeriod.isPending

  const form = useAppForm({
    schema: retentionPeriodFormSchema,
    defaultValues: period ? toFormValues(period) : emptyValues,
    onSubmit: async ({ value }) => {
      if (isEdit && period) {
        const { id: _id, ...updatePayload } = value
        await updatePeriod.mutateAsync({ id: period.id, payload: updatePayload })
      } else {
        await createPeriod.mutateAsync(value)
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

interface RetentionPeriodFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  period: RetentionPeriodT | null
}

export function RetentionPeriodFormDialog({
  open,
  onOpenChange,
  period,
}: RetentionPeriodFormDialogProps) {
  const { t } = useTranslation('retention-period')
  const isEdit = period !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('form.editTitle') : t('form.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {open ? (
          <RetentionPeriodForm
            key={period?.id ?? 'create'}
            period={period}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
