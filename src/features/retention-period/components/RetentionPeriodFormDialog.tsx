import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
import { useFormError } from '@/lib/hooks/useFormError'
import { translateError } from '@/lib/utils/translate-error'

const BLOCKED_NUMBER_KEYS = ['e', 'E', '+', '-', '.', ',']

const emptyValues: RetentionPeriodFormValues = {
  durationValue: 1,
  durationUnit: 'YEAR',
}

function toFormValues(period: RetentionPeriodT): RetentionPeriodFormValues {
  return {
    durationValue: period.durationValue ?? 1,
    durationUnit: period.durationUnit ?? 'YEAR',
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
  const { formError, setFormError, clearFormError } = useFormError()
  const isEdit = period !== null
  const isPending = createPeriod.isPending || updatePeriod.isPending

  const form = useAppForm({
    schema: retentionPeriodFormSchema,
    defaultValues: period ? toFormValues(period) : emptyValues,
    onSubmit: async ({ value }) => {
      const payload = {
        durationValue: value.durationValue,
        durationUnit: value.durationUnit,
      }

      clearFormError()
      try {
        if (isEdit && period) {
          await updatePeriod.mutateAsync({ id: period.id, payload })
        } else {
          await createPeriod.mutateAsync(payload)
        }
      } catch (error) {
        setFormError(translateError(error))
        return
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
          name="durationValue"
          label={t('form.fields.durationValue.label')}
          render={(field) => (
            <Input
              id={field.name}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder={t('form.fields.durationValue.placeholder')}
              value={field.state.value ?? ''}
              onKeyDown={(event) => {
                if (BLOCKED_NUMBER_KEYS.includes(event.key)) {
                  event.preventDefault()
                }
              }}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData('text')
                if (!/^\d+$/.test(pasted.trim())) {
                  event.preventDefault()
                }
              }}
              onChange={(event) => {
                const digitsOnly = event.target.value.replace(/\D/g, '')
                field.handleChange(
                  digitsOnly ? Number(digitsOnly) : undefined,
                )
              }}
              onBlur={field.handleBlur}
            />
          )}
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

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
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
      <DialogContent className="sm:max-w-lg">
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
