import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Mail, Send, Settings2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  emailSenderQueryOptions,
  useTestEmailSender,
  useUpsertEmailSender,
} from '@/features/notification-config/queries'
import { emailSenderFormSchema } from '@/features/notification-config/schemas'
import type { EmailConfigStatusT } from '@/features/notification-config/types'
import { FormField, useAppForm } from '@/lib/forms'
import { cn } from '@/lib/utils/cn'

function hasSmtpHostMissing(status: EmailConfigStatusT | undefined): boolean {
  return status?.missingFields.includes('SMTP_HOST') === true
}

function getDefaultEmailSenderValues(status: EmailConfigStatusT | undefined) {
  return {
    fromEmail: status?.sender?.fromEmail ?? '',
    fromName: status?.sender?.fromName ?? '',
    replyTo: status?.sender?.replyTo ?? '',
    password: '',
  }
}

function getEmailSenderSummary(
  t: (key: string, options?: Record<string, unknown>) => string,
  status: EmailConfigStatusT | undefined,
): string {
  if (!status) return t('emailSender.summary.loading')

  if (hasSmtpHostMissing(status)) {
    return t('emailSender.summary.infraMissing')
  }

  if (status.configured && status.sender?.fromEmail) {
    const fromName = status.sender.fromName?.trim()
    if (fromName) {
      return t('emailSender.summary.configuredWithName', {
        fromName,
        fromEmail: status.sender.fromEmail,
      })
    }
    return t('emailSender.summary.configured', {
      fromEmail: status.sender.fromEmail,
    })
  }

  if (status.missingFields.length > 0) {
    return t('emailSender.summary.missingFields', {
      fields: status.missingFields.join(', '),
    })
  }

  return t('emailSender.summary.notConfigured')
}

export function EmailSenderSection() {
  const { t } = useTranslation('notification-config')
  const { data: emailStatus, isLoading } = useQuery(emailSenderQueryOptions())
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const infraMissing = hasSmtpHostMissing(emailStatus)

  return (
    <>
      <Card id="email-sender-section">
        <CardHeader className="flex flex-row items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
              <Mail className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">
                  {t('emailSender.title')}
                </CardTitle>
                {emailStatus ? (
                  <StatusBadge
                    status={emailStatus.configured ? 'active' : 'inactive'}
                    label={
                      emailStatus.configured
                        ? t('emailSender.status.ready')
                        : t('emailSender.status.notReady')
                    }
                  />
                ) : null}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {isLoading
                  ? t('emailSender.summary.loading')
                  : getEmailSenderSummary(t, emailStatus)}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setIsDialogOpen(true)}
          >
            <Settings2 className="size-4" />
            {emailStatus?.configured
              ? t('emailSender.actions.edit')
              : t('emailSender.actions.configure')}
          </Button>
        </CardHeader>
      </Card>

      <EmailSenderFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        emailStatus={emailStatus}
        isLoading={isLoading}
        infraMissing={infraMissing}
      />
    </>
  )
}

function EmailSenderFormDialog({
  open,
  onOpenChange,
  emailStatus,
  isLoading,
  infraMissing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  emailStatus?: EmailConfigStatusT
  isLoading: boolean
  infraMissing: boolean
}) {
  const { t } = useTranslation('notification-config')
  const saveMutation = useUpsertEmailSender()
  const testMutation = useTestEmailSender()
  const requiresPassword = !emailStatus?.sender?.hasPassword
  const canTestSend =
    emailStatus?.configured === true && !infraMissing && !testMutation.isPending

  const form = useAppForm({
    schema: emailSenderFormSchema,
    defaultValues: getDefaultEmailSenderValues(emailStatus),
    onSubmit: async ({ value }) => {
      if (requiresPassword && !value.password?.trim()) {
        toast.error(t('emailSender.errors.passwordRequired'))
        return
      }
      if (value.password === '') {
        toast.error(t('emailSender.errors.passwordEmpty'))
        return
      }

      const payload = {
        fromEmail: value.fromEmail,
        fromName: value.fromName?.trim() ? value.fromName.trim() : null,
        replyTo: value.replyTo?.trim() ? value.replyTo.trim() : null,
        ...(value.password?.trim() ? { password: value.password } : {}),
      }

      await saveMutation.mutateAsync(payload)
      form.setFieldValue('password', '')
    },
  })

  React.useEffect(() => {
    if (!open || !emailStatus) return
    form.setFieldValue('fromEmail', emailStatus.sender?.fromEmail ?? '')
    form.setFieldValue('fromName', emailStatus.sender?.fromName ?? '')
    form.setFieldValue('replyTo', emailStatus.sender?.replyTo ?? '')
    form.setFieldValue('password', '')
  }, [emailStatus, form, open])

  const isSaving = saveMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('emailSender.dialog.title')}</DialogTitle>
          <DialogDescription>{t('emailSender.description')}</DialogDescription>
        </DialogHeader>

        {infraMissing ? (
          <div className="rounded-md border border-destructive/40 bg-muted p-3 text-sm text-foreground">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p>{t('emailSender.infraBanner')}</p>
            </div>
          </div>
        ) : null}

        {emailStatus && !emailStatus.configured && !infraMissing ? (
          <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
            {t('emailSender.missingFields', {
              fields: emailStatus.missingFields.join(', '),
            })}
          </div>
        ) : null}

        {emailStatus ? (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">
              {t('emailSender.infra.host', {
                configured: emailStatus.infra.hostConfigured
                  ? t('emailSender.infra.yes')
                  : t('emailSender.infra.no'),
              })}
            </Badge>
            <Badge variant="outline">
              {t('emailSender.infra.port', { port: emailStatus.infra.port })}
            </Badge>
            <Badge variant="outline">
              {t('emailSender.infra.secure', {
                secure: emailStatus.infra.secure
                  ? t('emailSender.infra.yes')
                  : t('emailSender.infra.no'),
              })}
            </Badge>
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('emailSender.loading')}</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                form={form}
                name="fromEmail"
                label={t('emailSender.form.fields.fromEmail.label')}
                render={(field) => (
                  <Input
                    type="email"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t(
                      'emailSender.form.fields.fromEmail.placeholder',
                    )}
                    disabled={infraMissing || isSaving}
                    className="w-full"
                  />
                )}
              />

              <FormField
                form={form}
                name="fromName"
                label={t('emailSender.form.fields.fromName.label')}
                render={(field) => (
                  <Input
                    value={field.state.value ?? ''}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t(
                      'emailSender.form.fields.fromName.placeholder',
                    )}
                    disabled={infraMissing || isSaving}
                    className="w-full"
                  />
                )}
              />

              <FormField
                form={form}
                name="replyTo"
                label={t('emailSender.form.fields.replyTo.label')}
                render={(field) => (
                  <Input
                    type="email"
                    value={field.state.value ?? ''}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t(
                      'emailSender.form.fields.replyTo.placeholder',
                    )}
                    disabled={infraMissing || isSaving}
                    className="w-full"
                  />
                )}
              />

              <FormField
                form={form}
                name="password"
                label={t('emailSender.form.fields.password.label')}
                description={
                  requiresPassword
                    ? t('emailSender.form.fields.password.requiredHint')
                    : t('emailSender.form.fields.password.optionalHint')
                }
                render={(field) => (
                  <Input
                    type="password"
                    value={field.state.value ?? ''}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t(
                      'emailSender.form.fields.password.placeholder',
                    )}
                    disabled={infraMissing || isSaving}
                    className="w-full"
                    autoComplete="new-password"
                  />
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={!canTestSend}
                onClick={() => testMutation.mutate()}
              >
                <Send className="size-4" />
                {testMutation.isPending
                  ? t('emailSender.form.actions.sending')
                  : t('emailSender.form.actions.testSend')}
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  {t('emailSender.dialog.close')}
                </Button>
                <Button type="submit" disabled={infraMissing || isSaving}>
                  {isSaving
                    ? t('emailSender.form.actions.saving')
                    : t('emailSender.form.actions.save')}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function EmailChannelWarning({
  className,
}: {
  className?: string
}) {
  const { t } = useTranslation('notification-config')

  return (
    <div
      className={cn(
        'rounded-md border border-destructive/40 bg-muted p-3 text-sm text-foreground',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p>{t('warnings.emailSenderNotReady')}</p>
      </div>
    </div>
  )
}
