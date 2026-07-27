import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Eye, EyeOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { updateDownloadPassword } from '@/features/auth/api/authClient'
import { profileQueryKey } from '@/features/auth/queries'
import type { DownloadPinFormValues } from '@/features/auth/schemas'
import { createDownloadPinSchema } from '@/features/auth/schemas'
import type { UserT } from '@/features/auth/types'
import { FormField, useAppForm } from '@/lib/forms'
import { useFormError } from '@/lib/hooks/useFormError'

interface ChangeDownloadPinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserT
}

interface PinFieldInputProps {
  id: string
  placeholder: string
  value: string
  disabled?: boolean
  onBlur: () => void
  onChange: (value: string) => void
  autoComplete?: string
}

function PinFieldInput({
  id,
  placeholder,
  value,
  disabled,
  onBlur,
  onChange,
  autoComplete = 'new-password',
}: PinFieldInputProps) {
  const [showPin, setShowPin] = useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        type={showPin ? 'text' : 'password'}
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
        onClick={() => setShowPin((current) => !current)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
        aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
      >
        {showPin ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
      </button>
    </div>
  )
}

export function ChangeDownloadPinDialog({
  open,
  onOpenChange,
  user,
}: ChangeDownloadPinDialogProps) {
  const { t } = useTranslation('auth')
  const queryClient = useQueryClient()
  const { formError, setFormError, clearFormError } = useFormError()
  const hasExistingPin = Boolean(user.hasDownloadPassword)
  const schema = useMemo(
    () => createDownloadPinSchema(hasExistingPin),
    [hasExistingPin],
  )

  const mutation = useMutation({
    mutationFn: (values: DownloadPinFormValues) => {
      return updateDownloadPassword({
        downloadPassword: values.pin,
        downloadPasswordEnabled: true,
        ...(hasExistingPin
          ? { currentDownloadPassword: values.currentPin }
          : {}),
      })
    },
    onSuccess: (record) => {
      toast.success(t('downloadPin.success'))
      queryClient.setQueryData<UserT>(profileQueryKey, (current) =>
        current
          ? {
              ...current,
              hasDownloadPassword: record.hasDownloadPassword,
              downloadPasswordEnabled: record.downloadPasswordEnabled,
            }
          : current,
      )
      void queryClient.invalidateQueries({ queryKey: profileQueryKey })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      if (isAxiosError(error)) {
        const status = error.response?.status
        const message = [
          error.response?.data?.message,
          error.response?.data?.error,
          error.response?.data?.detail,
        ]
          .filter((value): value is string => typeof value === 'string')
          .join(' ')

        if (
          status === 401 ||
          status === 400 ||
          message.toLowerCase().includes('pin') ||
          message.toLowerCase().includes('mã pin')
        ) {
          setFormError(
            message || t('downloadPin.errors.invalidCurrentPin'),
          )
          return
        }
        setFormError(message || t('downloadPin.errors.failed'))
        return
      }
      setFormError(t('downloadPin.errors.failed'))
    },
  })

  const form = useAppForm({
    schema,
    defaultValues: {
      currentPin: '',
      pin: '',
      confirmPin: '',
    } satisfies DownloadPinFormValues,
    onSubmit: async ({ value }) => {
      clearFormError()
      await mutation.mutateAsync(value)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('downloadPin.title')}</DialogTitle>
          <DialogDescription>
            {hasExistingPin
              ? t('downloadPin.descriptionHasPin')
              : t('downloadPin.descriptionNew')}
          </DialogDescription>
        </DialogHeader>

        <form
          key={open ? `open-${hasExistingPin}` : 'closed'}
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-4"
        >
          {hasExistingPin ? (
            <FormField
              form={form}
              name="currentPin"
              label={t('downloadPin.fields.currentPin.label')}
              render={(field) => (
                <PinFieldInput
                  id="download-pin-current"
                  placeholder={t(
                    'downloadPin.fields.currentPin.placeholder',
                  )}
                  value={field.state.value ?? ''}
                  disabled={mutation.isPending}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                  autoComplete="current-password"
                />
              )}
            />
          ) : null}

          <FormField
            form={form}
            name="pin"
            label={t('downloadPin.fields.pin.label')}
            render={(field) => (
              <PinFieldInput
                id="download-pin"
                placeholder={t('downloadPin.fields.pin.placeholder')}
                value={field.state.value}
                disabled={mutation.isPending}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />

          <FormField
            form={form}
            name="confirmPin"
            label={t('downloadPin.fields.confirmPin.label')}
            render={(field) => (
              <PinFieldInput
                id="download-pin-confirm"
                placeholder={t(
                  'downloadPin.fields.confirmPin.placeholder',
                )}
                value={field.state.value}
                disabled={mutation.isPending}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />

          <p className="text-xs text-muted-foreground">
            {t('downloadPin.encryptBySecurityLevelHint')}
          </p>

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
              {t('downloadPin.actions.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t('downloadPin.actions.submitting')
                : t('downloadPin.actions.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
