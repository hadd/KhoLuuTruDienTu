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
  archiveFondFormSchema,
  type ArchiveFondFormValues,
} from '@/features/archive-fond/schemas'
import {
  useCreateArchiveFond,
  useUpdateArchiveFond,
} from '@/features/archive-fond/queries'
import type { ArchiveFondT } from '@/features/archive-fond/types'
import { FormField, useAppForm } from '@/lib/forms'

const emptyValues: ArchiveFondFormValues = {
  id: '',
  fondName: '',
  archiveAgency: '',
  adminstrativeHistory: '',
  fondType: '',
}

function toFormValues(fond: ArchiveFondT): ArchiveFondFormValues {
  return {
    id: fond.id,
    fondName: fond.fondName,
    archiveAgency: fond.archiveAgency,
    adminstrativeHistory: fond.adminstrativeHistory,
    fondType: fond.fondType,
  }
}

interface ArchiveFondFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fond: ArchiveFondT | null
}

export function ArchiveFondFormDialog({
  open,
  onOpenChange,
  fond,
}: ArchiveFondFormDialogProps) {
  const { t } = useTranslation('archive-fond')
  const createFond = useCreateArchiveFond()
  const updateFond = useUpdateArchiveFond()
  const isEdit = fond !== null
  const isPending = createFond.isPending || updateFond.isPending

  const form = useAppForm({
    schema: archiveFondFormSchema,
    defaultValues: fond ? toFormValues(fond) : emptyValues,
    onSubmit: async ({ value }) => {
      if (isEdit && fond) {
        const { id: _id, ...updatePayload } = value
        await updateFond.mutateAsync({ id: fond.id, payload: updatePayload })
      } else {
        await createFond.mutateAsync(value)
      }
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('form.editTitle') : t('form.createTitle')}
          </DialogTitle>
        </DialogHeader>

        <form
          key={open ? (fond?.id ?? 'create') : 'closed'}
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
              name="fondName"
              label={t('form.fields.fondName.label')}
              placeholder={t('form.fields.fondName.placeholder')}
            />
            <FormField
              form={form}
              name="archiveAgency"
              label={t('form.fields.archiveAgency.label')}
              placeholder={t('form.fields.archiveAgency.placeholder')}
            />
            <FormField
              form={form}
              name="fondType"
              label={t('form.fields.fondType.label')}
              placeholder={t('form.fields.fondType.placeholder')}
            />
          </div>

          <FormField
            form={form}
            name="adminstrativeHistory"
            label={t('form.fields.adminstrativeHistory.label')}
            placeholder={t('form.fields.adminstrativeHistory.placeholder')}
            as="textarea"
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  )
}
