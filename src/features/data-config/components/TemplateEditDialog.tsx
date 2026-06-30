import { Loader2, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUpdateMetadataTemplate } from '@/features/data-config/queries'
import { updateMetadataTemplateSchema } from '@/features/data-config/schemas'
import type { DocumentTypeTemplateT } from '@/features/data-config/types'
import { FormField, useAppForm } from '@/lib/forms'

interface TemplateEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: DocumentTypeTemplateT | null
}

function TemplateEditForm({
  template,
  onCancel,
  onSaved,
}: {
  template: DocumentTypeTemplateT
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation('data-config')
  const updateMutation = useUpdateMetadataTemplate()

  const form = useAppForm({
    schema: updateMetadataTemplateSchema,
    defaultValues: {
      name: template.name,
      description: template.description ?? '',
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({
        templateId: template.id,
        payload: {
          name: value.name,
          description: value.description,
        },
      })
      onSaved()
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
        label={t('documentTypes.picker.nameLabel')}
        placeholder={t('documentTypes.picker.namePlaceholder')}
      />
      <FormField
        form={form}
        name="description"
        label={t('documentTypes.picker.descriptionLabel')}
        placeholder={t('documentTypes.picker.descriptionPlaceholder')}
        as="textarea"
      />
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={updateMutation.isPending}
        >
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          {t('actions.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function TemplateEditDialog({
  open,
  onOpenChange,
  template,
}: TemplateEditDialogProps) {
  const { t } = useTranslation('data-config')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('documentTypes.edit.title')}</DialogTitle>
        </DialogHeader>
        {open && template ? (
          <TemplateEditForm
            key={template.id}
            template={template}
            onCancel={() => onOpenChange(false)}
            onSaved={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
