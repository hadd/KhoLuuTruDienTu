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
  securityAccessPasswordSchema,
  type SecurityAccessPasswordValues,
} from '@/features/security-level/schemas'
import { FormField, useAppForm } from '@/lib/forms'

interface SecurityAccessPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  onSubmit: (password: string) => Promise<void>
  isPending?: boolean
}

export function SecurityAccessPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  isPending,
}: SecurityAccessPasswordDialogProps) {
  const { t } = useTranslation('security-level')

  const form = useAppForm({
    schema: securityAccessPasswordSchema,
    defaultValues: { password: '' } satisfies SecurityAccessPasswordValues,
    onSubmit: async ({ value }) => {
      await onSubmit(value.password)
      onOpenChange(false)
    },
  })

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
            <FormField
              form={form}
              name="password"
              label={t('access.passwordLabel')}
              type="password"
              autoFocus
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
                {isPending ? t('access.verifying') : t('access.verify')}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
