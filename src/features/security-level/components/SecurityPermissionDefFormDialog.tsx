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
  securityPermissionDefEditSchema,
  securityPermissionDefFormSchema,
  type SecurityPermissionDefEditValues,
  type SecurityPermissionDefFormValues,
} from '@/features/security-level/schemas'
import {
  useCreateSecurityPermissionDef,
  useUpdateSecurityPermissionDef,
} from '@/features/security-level/queries'
import type { SecurityPermissionDefT } from '@/features/security-level/types'
import { FormField, useAppForm } from '@/lib/forms'

const emptyCreateValues: SecurityPermissionDefFormValues = {
  key: '',
  name: '',
  description: '',
}

function CreatePermissionDefForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('security-level')
  const createDef = useCreateSecurityPermissionDef()

  const form = useAppForm({
    schema: securityPermissionDefFormSchema,
    defaultValues: emptyCreateValues,
    onSubmit: async ({ value }) => {
      await createDef.mutateAsync({
        key: value.key,
        name: value.name,
        description: value.description,
      })
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
        name="key"
        label={t('permissions.form.fields.key.label')}
        placeholder={t('permissions.form.fields.key.placeholder')}
        autoFocus
      />
      <p className="text-xs text-muted-foreground">
        {t('permissions.form.fields.key.hint')}
      </p>

      <FormField
        form={form}
        name="name"
        label={t('permissions.form.fields.name.label')}
        placeholder={t('permissions.form.fields.name.placeholder')}
      />

      <FormField
        form={form}
        name="description"
        label={t('permissions.form.fields.description.label')}
        placeholder={t('permissions.form.fields.description.placeholder')}
        as="textarea"
      />

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={createDef.isPending}
        >
          {t('form.actions.cancel')}
        </Button>
        <Button type="submit" disabled={createDef.isPending}>
          {createDef.isPending
            ? t('form.actions.saving')
            : t('form.actions.create')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function EditPermissionDefForm({
  permissionDef,
  onClose,
}: {
  permissionDef: SecurityPermissionDefT
  onClose: () => void
}) {
  const { t } = useTranslation('security-level')
  const updateDef = useUpdateSecurityPermissionDef()

  const form = useAppForm({
    schema: securityPermissionDefEditSchema,
    defaultValues: {
      name: permissionDef.name,
      description: permissionDef.description,
    } satisfies SecurityPermissionDefEditValues,
    onSubmit: async ({ value }) => {
      await updateDef.mutateAsync({
        id: permissionDef.id,
        payload: {
          name: value.name,
          description: value.description,
        },
      })
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
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {t('permissions.form.fields.key.label')}
        </p>
        <p className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
          {permissionDef.key}
        </p>
      </div>

      <FormField
        form={form}
        name="name"
        label={t('permissions.form.fields.name.label')}
        placeholder={t('permissions.form.fields.name.placeholder')}
        autoFocus
      />

      <FormField
        form={form}
        name="description"
        label={t('permissions.form.fields.description.label')}
        placeholder={t('permissions.form.fields.description.placeholder')}
        as="textarea"
      />

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updateDef.isPending}
        >
          {t('form.actions.cancel')}
        </Button>
        <Button type="submit" disabled={updateDef.isPending}>
          {updateDef.isPending
            ? t('form.actions.saving')
            : t('form.actions.update')}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface SecurityPermissionDefFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  permissionDef: SecurityPermissionDefT | null
}

export function SecurityPermissionDefFormDialog({
  open,
  onOpenChange,
  permissionDef,
}: SecurityPermissionDefFormDialogProps) {
  const { t } = useTranslation('security-level')
  const isEdit = permissionDef !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('permissions.form.editTitle')
              : t('permissions.form.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {open ? (
          isEdit ? (
            <EditPermissionDefForm
              key={permissionDef.id}
              permissionDef={permissionDef}
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <CreatePermissionDefForm
              key="create"
              onClose={() => onOpenChange(false)}
            />
          )
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
