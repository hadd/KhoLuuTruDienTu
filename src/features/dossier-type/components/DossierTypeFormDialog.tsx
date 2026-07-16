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
  dossierTypeFormSchema,
  type DossierTypeFormValues,
} from '@/features/dossier-type/schemas'
import {
  useCreateDossierType,
  useUpdateDossierType,
} from '@/features/dossier-type/queries'
import type { DossierTypeT } from '@/features/dossier-type/types'
import { FormField, useAppForm } from '@/lib/forms'

const emptyValues: DossierTypeFormValues = {
  id: '',
  name: '',
  description: '',
}

function toFormValues(dossierType: DossierTypeT): DossierTypeFormValues {
  return {
    id: dossierType.id,
    name: dossierType.name,
    description: dossierType.description,
  }
}

interface DossierTypeFormProps {
  dossierType: DossierTypeT | null
  onClose: () => void
  readOnly?: boolean
}

function DossierTypeForm({
  dossierType,
  onClose,
  readOnly = false,
}: DossierTypeFormProps) {
  const { t } = useTranslation('dossier-type')
  const createDossierType = useCreateDossierType()
  const updateDossierType = useUpdateDossierType()
  const isEdit = dossierType !== null
  const isPending = createDossierType.isPending || updateDossierType.isPending
  const isReadOnly = readOnly

  const form = useAppForm({
    schema: dossierTypeFormSchema,
    defaultValues: dossierType ? toFormValues(dossierType) : emptyValues,
    onSubmit: async ({ value }) => {
      if (isEdit && dossierType) {
        const { id: _id, ...updatePayload } = value
        await updateDossierType.mutateAsync({
          id: dossierType.id,
          payload: updatePayload,
        })
      } else {
        await createDossierType.mutateAsync(value)
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
          disabled={isEdit || isReadOnly}
        />
        <FormField
          form={form}
          name="name"
          label={t('form.fields.name.label')}
          placeholder={t('form.fields.name.placeholder')}
          disabled={isReadOnly}
        />
      </div>

      <FormField
        form={form}
        name="description"
        label={t('form.fields.description.label')}
        placeholder={t('form.fields.description.placeholder')}
        as="textarea"
        disabled={isReadOnly}
      />

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          {isReadOnly ? t('form.actions.close') : t('form.actions.cancel')}
        </Button>
        {!isReadOnly ? (
          <Button type="submit" disabled={isPending}>
            {isPending
              ? t('form.actions.saving')
              : isEdit
                ? t('form.actions.update')
                : t('form.actions.create')}
          </Button>
        ) : null}
      </DialogFooter>
    </form>
  )
}

interface DossierTypeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierType: DossierTypeT | null
  readOnly?: boolean
}

export function DossierTypeFormDialog({
  open,
  onOpenChange,
  dossierType,
  readOnly = false,
}: DossierTypeFormDialogProps) {
  const { t } = useTranslation('dossier-type')
  const isEdit = dossierType !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? t('form.viewTitle')
              : isEdit
                ? t('form.editTitle')
                : t('form.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {open ? (
          <DossierTypeForm
            key={dossierType?.id ?? 'create'}
            dossierType={dossierType}
            onClose={() => onOpenChange(false)}
            readOnly={readOnly}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
