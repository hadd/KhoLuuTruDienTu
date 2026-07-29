import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import type { SecurityAccessPasswordValues } from '@/features/security-level/schemas'
import { securityAccessPasswordSchema } from '@/features/security-level/schemas'
import { useAppForm } from '@/lib/forms'

interface SecurityAccessPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  errorMessage?: string
  onSubmit: (password: string) => Promise<void>
  isPending?: boolean
  closeOnSubmit?: boolean
}

export function PasswordInputWithToggle({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  autoFocus,
  autoComplete = 'current-password',
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  autoComplete?: string
}) {
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (disabled) setShowPassword(false)
  }, [disabled])

  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
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
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
        tabIndex={-1}
        disabled={disabled}
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

export function SecurityAccessPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  errorMessage,
  onSubmit,
  isPending,
  closeOnSubmit = true,
}: SecurityAccessPasswordDialogProps) {
  const { t } = useTranslation('security-level')

  const form = useAppForm({
    schema: securityAccessPasswordSchema,
    defaultValues: { password: '' } satisfies SecurityAccessPasswordValues,
    onSubmit: async ({ value }) => {
      await onSubmit(value.password)
      if (closeOnSubmit) onOpenChange(false)
    },
  })

  useEffect(() => {
    if (!open) {
      form.setFieldValue('password', '')
    }
  }, [open, form])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
        {open ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="security-access-password">
                    {t('access.passwordLabel')} *
                  </Label>
                  <PasswordInputWithToggle
                    id="security-access-password"
                    autoFocus
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(value) => field.handleChange(value)}
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p className="text-sm text-destructive">
                      {String(field.state.meta.errors[0])}
                    </p>
                  ) : null}
                  {errorMessage ? (
                    <p className="text-sm text-destructive" role="alert">
                      {errorMessage}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>
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
                {isPending ? t('access.verifying') : t('access.verify')}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
