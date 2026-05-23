import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { RoleT, UserT } from '@/features/auth/types'
import { createUser, updateUser } from '@/features/user/api/userClient'
import {
  emptyUserFormValues,
  formValuesToCreatePayload,
  formValuesToUpdatePayload,
  userToFormValues,
} from '@/features/user/lib/userFormUtils'
import { getRoleLabel } from '@/features/user/lib/roleLabels'
import {
  adminRolesQueryOptions,
  adminUsersQueryKey,
} from '@/features/user/queries'
import {
  AdminUserCreateSchema,
  AdminUserUpdateSchema,
 
} from '@/features/user/schemas'
import type { AdminUserFormValues } from '@/features/user/schemas'
import { FormField, useAppForm } from '@/lib/forms'
import { translateError } from '@/lib/utils/translate-error'

export type UserUpsertMode = 'create' | 'edit'

interface UserUpsertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: UserUpsertMode
  user: UserT | null
}

function UserUpsertForm({
  mode,
  user,
  onSuccess,
  onCancel,
}: {
  mode: UserUpsertMode
  user: UserT | null
  onSuccess: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation('user')
  const { t: tCommon } = useTranslation('common')
  const queryClient = useQueryClient()

  const { data: roles = [], isLoading: isLoadingRoles } = useQuery(adminRolesQueryOptions())

  const defaultValues = useMemo(
    () => (mode === 'edit' && user ? userToFormValues(user) : emptyUserFormValues),
    [mode, user],
  )

  const schema = mode === 'create' ? AdminUserCreateSchema : AdminUserUpdateSchema

  const mutation = useMutation({
    mutationFn: async (values: AdminUserFormValues) => {
      if (mode === 'create') {
        return createUser(formValuesToCreatePayload(values))
      }
      if (!user) throw new Error('User is required for update')
      return updateUser(user.id, formValuesToUpdatePayload(values))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminUsersQueryKey })
      toast.success(
        mode === 'create' ? t('form.success.create') : t('form.success.update'),
      )
      onSuccess()
    },
    onError: (error: Error) => {
      toast.error(translateError(error) || t('errors.saveFailed'))
    },
  })

  const form = useAppForm({
    schema,
    defaultValues,
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value)
    },
  })

  const genderOptions = useMemo(
    () => [
      { value: 'male', label: t('form.gender.male') },
      { value: 'female', label: t('form.gender.female') },
    ],
    [t],
  )

  const primaryLabel =
    mode === 'create' ? t('actions.createSubmit') : t('actions.save')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <div className="grid max-h-[min(70vh,32rem)] gap-4 overflow-y-auto py-2 pr-1">
        <FormField
          form={form}
          name="fullName"
          label={t('form.fields.fullName.label')}
          placeholder={t('form.fields.fullName.placeholder')}
          autoFocus
        />
        <FormField
          form={form}
          name="email"
          label={t('form.fields.email.label')}
          placeholder={t('form.fields.email.placeholder')}
        />
        <FormField
          form={form}
          name="password"
          label={t('form.fields.password.label')}
          placeholder={t('form.fields.password.placeholder')}
          description={mode === 'edit' ? t('form.passwordOptionalHint') : undefined}
          render={(field) => (
            <Input
              id="user-password"
              type="password"
              autoComplete={mode === 'create' ? 'new-password' : 'off'}
              placeholder={t('form.fields.password.placeholder')}
              value={field.state.value as string}
              disabled={mutation.isPending}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className="w-full"
            />
          )}
        />
        <FormField
          form={form}
          name="dateOfBirth"
          label={t('form.fields.dateOfBirth.label')}
          placeholder={t('form.fields.dateOfBirth.placeholder')}
          as="date"
        />
        <FormField
          form={form}
          name="gender"
          label={t('form.fields.gender.label')}
          placeholder={t('form.fields.gender.placeholder')}
          as="select"
          options={genderOptions}
        />
        <FormField
          form={form}
          name="phone"
          label={t('form.fields.phone.label')}
          placeholder={t('form.fields.phone.placeholder')}
        />
        <FormField
          form={form}
          name="address"
          label={t('form.fields.address.label')}
          placeholder={t('form.fields.address.placeholder')}
          as="textarea"
        />
        <FormField
          form={form}
          name="role"
          label={t('form.fields.role.label')}
          placeholder={t('form.fields.role.placeholder')}
          as="select"
          disabled={isLoadingRoles || mutation.isPending}
          options={roles.map((r) => ({
            value: r.id,
            label: getRoleLabel(r.id, r.name) ?? r.name,
          }))}
        />
      </div>

      <DialogFooter className="gap-2 sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
          {tCommon('common.cancel')}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mutation.isPending ? t('actions.saving') : primaryLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function UserUpsertDialog({
  open,
  onOpenChange,
  mode,
  user,
}: UserUpsertDialogProps) {
  const { t } = useTranslation('user')

  const formKey = mode === 'edit' && user ? user.id : 'create'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('dialog.createTitle') : t('dialog.editTitle')}
          </DialogTitle>
        </DialogHeader>

        <UserUpsertForm
          key={formKey}
          mode={mode}
          user={user}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
