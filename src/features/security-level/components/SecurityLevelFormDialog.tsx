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
  securityLevelFormSchema,
  type SecurityLevelFormValues,
} from '@/features/security-level/schemas'
import {
  useCreateSecurityLevel,
  useUpdateSecurityLevel,
} from '@/features/security-level/queries'
import type { SecurityLevelT } from '@/features/security-level/types'
import { FormField, useAppForm } from '@/lib/forms'

const emptyValues: SecurityLevelFormValues = {
  name: '',
  levelOrder: undefined as unknown as number,
  description: '',
}

function toFormValues(securityLevel: SecurityLevelT): SecurityLevelFormValues {
  return {
    name: securityLevel.name,
    levelOrder: securityLevel.levelOrder,
    description: securityLevel.description,
  }
}

interface SecurityLevelFormProps {
  securityLevel: SecurityLevelT | null
  onClose: () => void
}

function SecurityLevelForm({ securityLevel, onClose }: SecurityLevelFormProps) {
  const { t } = useTranslation('security-level')
  const createSecurityLevel = useCreateSecurityLevel()
  const updateSecurityLevel = useUpdateSecurityLevel()
  const isEdit = securityLevel !== null
  const isPending =
    createSecurityLevel.isPending || updateSecurityLevel.isPending

  const form = useAppForm({
    schema: securityLevelFormSchema,
    defaultValues: securityLevel ? toFormValues(securityLevel) : emptyValues,
    onSubmit: async ({ value }) => {
      if (isEdit && securityLevel) {
        await updateSecurityLevel.mutateAsync({
          id: securityLevel.id,
          payload: value,
        })
      } else {
        await createSecurityLevel.mutateAsync(value)
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
      <FormField
        form={form}
        name="name"
        label={t('form.fields.name.label')}
        placeholder={t('form.fields.name.placeholder')}
        autoFocus
      />

      <FormField
        form={form}
        name="levelOrder"
        label={t('form.fields.levelOrder.label')}
        placeholder={t('form.fields.levelOrder.placeholder')}
        description={t('form.fields.levelOrder.description')}
        as="number"
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

interface SecurityLevelFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  securityLevel: SecurityLevelT | null
}

export function SecurityLevelFormDialog({
  open,
  onOpenChange,
  securityLevel,
}: SecurityLevelFormDialogProps) {
  const { t } = useTranslation('security-level')
  const isEdit = securityLevel !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('form.editTitle') : t('form.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {open ? (
          <SecurityLevelForm
            key={securityLevel?.id ?? 'create'}
            securityLevel={securityLevel}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
