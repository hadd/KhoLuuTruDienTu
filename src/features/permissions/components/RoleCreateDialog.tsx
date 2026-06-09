import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCreateAdminRole } from '@/features/permissions/queries'
import {
  adminRoleSchema,
  type AdminRoleFormValues,
} from '@/features/permissions/schemas'
import { FormField, useAppForm } from '@/lib/forms'

const emptyValues: AdminRoleFormValues = {
  id: '',
  name: '',
  description: '',
}

interface RoleCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (roleId: string) => void
}

export function RoleCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: RoleCreateDialogProps) {
  const { t } = useTranslation('permissions')
  const createRole = useCreateAdminRole()

  const form = useAppForm({
    schema: adminRoleSchema,
    defaultValues: emptyValues,
    onSubmit: async ({ value }) => {
      const role = await createRole.mutateAsync({
        id: value.id.trim(),
        name: value.name.trim(),
        description: value.description.trim(),
      })
      onOpenChange(false)
      onCreated?.(role.id)
    },
  })

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('roles.form.createTitle')}</DialogTitle>
        </DialogHeader>

        <form
          key={open ? 'open' : 'closed'}
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-4"
        >
          <FormField
            form={form}
            name="id"
            label={t('roles.form.fields.id.label')}
            placeholder={t('roles.form.fields.id.placeholder')}
          />
          <FormField
            form={form}
            name="name"
            label={t('roles.form.fields.name.label')}
            placeholder={t('roles.form.fields.name.placeholder')}
          />
          <FormField
            form={form}
            name="description"
            label={t('roles.form.fields.description.label')}
            placeholder={t('roles.form.fields.description.placeholder')}
            as="textarea"
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createRole.isPending}
            >
              {t('roles.form.actions.cancel')}
            </Button>
            <Button type="submit" disabled={createRole.isPending}>
              {createRole.isPending
                ? t('roles.form.actions.saving')
                : t('roles.form.actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
