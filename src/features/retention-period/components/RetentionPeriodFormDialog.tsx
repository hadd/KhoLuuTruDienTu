import { useStore } from '@tanstack/react-form'
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
  isPermanent: false,
  durationValue: null,
  durationUnit: null,
}

function toFormValues(period: RetentionPeriodT): RetentionPeriodFormValues {
  return {
    id: period.id,
    name: period.name,
    description: period.description,
    isPermanent: period.isPermanent,
    durationValue: period.durationValue,
    durationUnit: period.durationUnit,
  }
}

function toPayload(value: RetentionPeriodFormValues) {
  if (value.isPermanent) {
    return {
      name: value.name,
      description: value.description,
      isPermanent: true,
      durationValue: null,
      durationUnit: null,
    }
  }

  return {
    name: value.name,
    description: value.description,
    isPermanent: false,
    durationValue: value.durationValue ?? null,
    durationUnit: value.durationUnit ?? null,
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
      const payload = toPayload(value)

      if (isEdit && period) {
        await updatePeriod.mutateAsync({ id: period.id, payload })
      } else {
        await createPeriod.mutateAsync({
          id: value.id,
          ...payload,
        })
      }
      onClose()
    },
  })

  const isPermanent = useStore(
    form.store,
    (state) => (state as { values: RetentionPeriodFormValues }).values.isPermanent,
  )

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

      <div className="space-y-2">
        <FormField
          form={form}
          name="isPermanent"
          label={t('form.fields.isPermanent.label')}
          variant="checkbox"
          render={(field) => (
            <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5">
              <input
                id="retention-period-is-permanent"
                type="checkbox"
                className="size-4"
                checked={Boolean(field.state.value)}
                onChange={(event) => {
                  const checked = event.target.checked
                  field.handleChange(checked)
                  if (checked) {
                    form.setFieldValue('durationValue', null)
                    form.setFieldValue('durationUnit', null)
                  }
                }}
              />
              <span className="text-sm text-muted-foreground">
                {t('form.fields.isPermanent.description')}
              </span>
            </label>
          )}
        />
      </div>

      {!isPermanent ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            form={form}
            name="durationValue"
            label={t('form.fields.durationValue.label')}
            placeholder={t('form.fields.durationValue.placeholder')}
            type="number"
            min={1}
          />
          <FormField
            form={form}
            name="durationUnit"
            label={t('form.fields.durationUnit.label')}
            placeholder={t('form.fields.durationUnit.placeholder')}
            options={[
              { value: 'YEAR', label: t('duration.unitLabels.YEAR') },
              { value: 'MONTH', label: t('duration.unitLabels.MONTH') },
              { value: 'DAY', label: t('duration.unitLabels.DAY') },
            ]}
          />
        </div>
      ) : null}

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
