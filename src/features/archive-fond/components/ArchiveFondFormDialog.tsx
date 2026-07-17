import { useTranslation } from 'react-i18next'
import { useStore } from '@tanstack/react-form'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
  isActive: true,
  zipPasswordEnabled: false,
  zipPassword: '',
  clearZipPassword: false,
}

function toFormValues(fond: ArchiveFondT): ArchiveFondFormValues {
  return {
    id: fond.id,
    fondName: fond.fondName,
    archiveAgency: fond.archiveAgency,
    adminstrativeHistory: fond.adminstrativeHistory,
    fondType: fond.fondType,
    isActive: fond.isActive,
    zipPasswordEnabled: fond.zipPasswordEnabled,
    zipPassword: '',
    clearZipPassword: false,
  }
}

interface ArchiveFondFormProps {
  fond: ArchiveFondT | null
  onClose: () => void
}

function ArchiveFondForm({ fond, onClose }: ArchiveFondFormProps) {
  const { t } = useTranslation('archive-fond')
  const createFond = useCreateArchiveFond()
  const updateFond = useUpdateArchiveFond()
  const isEdit = fond !== null
  const isPending = createFond.isPending || updateFond.isPending

  const form = useAppForm({
    schema: archiveFondFormSchema,
    defaultValues: fond ? toFormValues(fond) : emptyValues,
    onSubmit: async ({ value }) => {
      const zipPassword = value.zipPassword?.trim() || undefined

      if (isEdit && fond) {
        const { id: _id, zipPassword: _pw, clearZipPassword, ...rest } = value
        const payload: Parameters<typeof updateFond.mutateAsync>[0]['payload'] =
          { ...rest }
        if (clearZipPassword) {
          payload.zipPassword = null
        } else if (zipPassword) {
          payload.zipPassword = zipPassword
        }
        const willHave = clearZipPassword
          ? Boolean(zipPassword)
          : Boolean(fond.hasZipPassword) || Boolean(zipPassword)
        if (!willHave) {
          payload.zipPasswordEnabled = false
        }
        await updateFond.mutateAsync({ id: fond.id, payload })
      } else {
        const { clearZipPassword: _clear, zipPassword: _pw, ...rest } = value
        await createFond.mutateAsync({
          ...rest,
          zipPasswordEnabled: zipPassword ? rest.zipPasswordEnabled : false,
          ...(zipPassword ? { zipPassword } : {}),
        })
      }
      onClose()
    },
  })

  const clearZipPassword = useStore(
    form.store,
    (state) => state.values.clearZipPassword,
  )
  const zipPasswordEnabled = useStore(
    form.store,
    (state) => state.values.zipPasswordEnabled,
  )
  const zipPasswordInput = useStore(
    form.store,
    (state) => state.values.zipPassword,
  )

  // Whether a password will exist after this save (existing kept, or newly typed).
  const willHavePassword = clearZipPassword
    ? Boolean(zipPasswordInput?.trim())
    : Boolean(fond?.hasZipPassword) || Boolean(zipPasswordInput?.trim())

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

      <FormField
        form={form}
        name="zipPassword"
        label={t('form.fields.zipPassword.label')}
        description={t('form.fields.zipPassword.hint')}
        disabled={isEdit && clearZipPassword}
        render={(field) => (
          <Input
            type="password"
            autoComplete="new-password"
            value={String(field.state.value ?? '')}
            disabled={isEdit && clearZipPassword}
            placeholder={
              isEdit && fond?.hasZipPassword
                ? t('form.fields.zipPassword.placeholderKeep')
                : t('form.fields.zipPassword.placeholder')
            }
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      />
      {isEdit && fond?.hasZipPassword ? (
        <FormField
          form={form}
          name="clearZipPassword"
          label={t('form.fields.zipPassword.clear')}
          render={(field) => (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(field.state.value)}
                onCheckedChange={(checked) =>
                  field.handleChange(checked === true)
                }
              />
              {t('form.fields.zipPassword.clear')}
            </label>
          )}
        />
      ) : null}

      <FormField
        form={form}
        name="zipPasswordEnabled"
        label={t('form.fields.zipPasswordEnabled.label')}
        description={t('form.fields.zipPasswordEnabled.hint')}
        render={(field) => (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={Boolean(field.state.value) && willHavePassword}
              disabled={!willHavePassword}
              onCheckedChange={(checked) => field.handleChange(checked === true)}
            />
            {willHavePassword
              ? t('form.fields.zipPasswordEnabled.label')
              : t('form.fields.zipPasswordEnabled.needsPassword')}
          </label>
        )}
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
  const isEdit = fond !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('form.editTitle') : t('form.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {open ? (
          <ArchiveFondForm
            key={fond?.id ?? 'create'}
            fond={fond}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
