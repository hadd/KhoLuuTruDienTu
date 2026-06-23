import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
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
import { resetPassword } from '@/features/auth/api/authClient'
import { ChangePasswordSchema } from '@/features/auth/schemas'
import type { ChangePasswordFormValues } from '@/features/auth/schemas'
import { useFormError } from '@/lib/hooks/useFormError'
import { FormField, useAppForm } from '@/lib/forms'

const emptyValues: ChangePasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
}

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}

interface PasswordFieldInputProps {
  id: string
  placeholder: string
  value: string
  disabled?: boolean
  onBlur: () => void
  onChange: (value: string) => void
  autoComplete?: string
}

function PasswordFieldInput({
  id,
  placeholder,
  value,
  disabled,
  onBlur,
  onChange,
  autoComplete,
}: PasswordFieldInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShowPassword((current) => !current)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
      </button>
    </div>
  )
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  userId,
}: ChangePasswordDialogProps) {
  const { t } = useTranslation('auth')
  const { formError, setFormError, clearFormError } = useFormError()

  const getErrorMessage = (error: unknown) => {
    if (isAxiosError(error)) {
      const status = error.response?.status
      const message = [
        error.response?.data?.message,
        error.response?.data?.error,
        error.response?.data?.detail,
        error.message,
      ]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase()

      if (
        status === 400 ||
        status === 401 ||
        status === 403 ||
        status === 422 ||
        message.includes('current') ||
        message.includes('password') ||
        message.includes('mật khẩu')
      ) {
        return t('changePassword.errors.invalidCurrentPassword')
      }
    }

    return t('changePassword.errors.failed')
  }

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      resetPassword(userId, {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      toast.success(t('changePassword.success'))
      onOpenChange(false)
    },
    onError: (error: Error) => {
      setFormError(getErrorMessage(error))
    },
  })

  const form = useAppForm({
    schema: ChangePasswordSchema,
    defaultValues: emptyValues,
    onSubmit: async ({ value }) => {
      clearFormError()
      await mutation.mutateAsync(value)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('changePassword.title')}</DialogTitle>
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
            name="currentPassword"
            label={t('changePassword.fields.currentPassword.label')}
            render={(field) => (
              <PasswordFieldInput
                id="current-password"
                placeholder={t('changePassword.fields.currentPassword.placeholder')}
                value={field.state.value}
                disabled={mutation.isPending}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                autoComplete="current-password"
              />
            )}
          />

          <FormField
            form={form}
            name="newPassword"
            label={t('changePassword.fields.newPassword.label')}
            render={(field) => (
              <PasswordFieldInput
                id="new-password"
                placeholder={t('changePassword.fields.newPassword.placeholder')}
                value={field.state.value}
                disabled={mutation.isPending}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                autoComplete="new-password"
              />
            )}
          />

          <FormField
            form={form}
            name="confirmNewPassword"
            label={t('changePassword.fields.confirmNewPassword.label')}
            render={(field) => (
              <PasswordFieldInput
                id="confirm-new-password"
                placeholder={t(
                  'changePassword.fields.confirmNewPassword.placeholder',
                )}
                value={field.state.value}
                disabled={mutation.isPending}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                autoComplete="new-password"
              />
            )}
          />

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t('changePassword.actions.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t('changePassword.actions.submitting')
                : t('changePassword.actions.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
