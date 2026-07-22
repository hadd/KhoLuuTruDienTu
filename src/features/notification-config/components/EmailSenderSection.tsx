import { useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Mail, Send, Settings2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  emailSenderQueryOptions,
  useTestEmailSender,
  useUpsertEmailSender,
} from '@/features/notification-config/queries'
import { emailSenderFormSchema } from '@/features/notification-config/schemas'
import {
  inferSmtpProvider,
  resolvePresetFields,
  SMTP_PROVIDER_OPTIONS,
  type SmtpProviderT,
} from '@/features/notification-config/smtpPresets'
import type { EmailConfigStatusT } from '@/features/notification-config/types'
import { FormField, useAppForm } from '@/lib/forms'
import { cn } from '@/lib/utils/cn'

function getDefaultEmailSenderValues(status: EmailConfigStatusT | undefined) {
  const provider = status?.smtpProvider ?? inferSmtpProvider(status?.smtp.host)
  const preset = resolvePresetFields(provider, status?.smtp.host ?? '')

  return {
    smtpProvider: provider,
    smtpHost: status?.smtp.host ?? preset.smtpHost,
    smtpPort: status?.smtp.port ?? preset.smtpPort,
    smtpSecure: status?.smtp.secure ?? preset.smtpSecure,
    smtpUser: status?.smtp.user ?? '',
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

  if (status.configured && status.sender?.fromEmail) {
    const host = status.smtp.host ?? '—'
    const fromName = status.sender.fromName?.trim()
    if (fromName) {
      return t('emailSender.summary.configuredWithHost', {
        fromName,
        fromEmail: status.sender.fromEmail,
        host,
      })
    }
    return t('emailSender.summary.configuredWithHostOnly', {
      fromEmail: status.sender.fromEmail,
      host,
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
      />
    </>
  )
}

function EmailSenderFormDialog({
  open,
  onOpenChange,
  emailStatus,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  emailStatus?: EmailConfigStatusT
  isLoading: boolean
}) {
  const { t } = useTranslation('notification-config')
  const saveMutation = useUpsertEmailSender()
  const testMutation = useTestEmailSender()
  const requiresPassword = !emailStatus?.sender?.hasPassword
  const canTestSend = emailStatus?.configured === true && !testMutation.isPending

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
      if (value.smtpProvider === 'custom' && !value.smtpHost?.trim()) {
        toast.error(t('emailSender.errors.smtpHostRequired'))
        return
      }

      const preset = resolvePresetFields(value.smtpProvider, value.smtpHost)

      const payload = {
        smtpProvider: value.smtpProvider,
        smtpHost:
          value.smtpProvider === 'custom'
            ? value.smtpHost?.trim()
            : preset.smtpHost,
        smtpPort: value.smtpPort,
        smtpSecure: value.smtpSecure,
        smtpUser: value.smtpUser?.trim() ? value.smtpUser.trim() : null,
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
    const defaults = getDefaultEmailSenderValues(emailStatus)
    form.setFieldValue('smtpProvider', defaults.smtpProvider)
    form.setFieldValue('smtpHost', defaults.smtpHost)
    form.setFieldValue('smtpPort', defaults.smtpPort)
    form.setFieldValue('smtpSecure', defaults.smtpSecure)
    form.setFieldValue('smtpUser', defaults.smtpUser)
    form.setFieldValue('fromEmail', defaults.fromEmail)
    form.setFieldValue('fromName', defaults.fromName)
    form.setFieldValue('replyTo', defaults.replyTo)
    form.setFieldValue('password', '')
  }, [emailStatus, form, open])

  const smtpProvider = useStore(form.store, (state) => state.values.smtpProvider)
  const isCustomProvider = smtpProvider === 'custom'
  const isSaving = saveMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('emailSender.dialog.title')}</DialogTitle>
          <DialogDescription>{t('emailSender.description')}</DialogDescription>
        </DialogHeader>

        {emailStatus && !emailStatus.configured ? (
          <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
            {t('emailSender.missingFields', {
              fields: emailStatus.missingFields.join(', '),
            })}
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
            <FormField
              form={form}
              name="smtpProvider"
              label={t('emailSender.form.fields.smtpProvider.label')}
              render={(field) => (
                <Select
                  value={field.state.value}
                  onValueChange={(value) => {
                    const provider = value as SmtpProviderT
                    field.handleChange(provider)
                    const preset = resolvePresetFields(provider)
                    form.setFieldValue('smtpHost', preset.smtpHost)
                    form.setFieldValue('smtpPort', preset.smtpPort)
                    form.setFieldValue('smtpSecure', preset.smtpSecure)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SMTP_PROVIDER_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                form={form}
                name="smtpHost"
                label={t('emailSender.form.fields.smtpHost.label')}
                render={(field) => (
                  <Input
                    value={field.state.value ?? ''}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('emailSender.form.fields.smtpHost.placeholder')}
                    disabled={!isCustomProvider || isSaving}
                    className="w-full"
                  />
                )}
              />

              <FormField
                form={form}
                name="smtpPort"
                label={t('emailSender.form.fields.smtpPort.label')}
                render={(field) => (
                  <Input
                    type="number"
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(Number(event.target.value) || 587)
                    }
                    onBlur={field.handleBlur}
                    disabled={!isCustomProvider || isSaving}
                    className="w-full"
                  />
                )}
              />

              <FormField
                form={form}
                name="smtpSecure"
                label={t('emailSender.form.fields.smtpSecure.label')}
                render={(field) => (
                  <div className="flex h-10 items-center gap-2 sm:col-span-2">
                    <Checkbox
                      checked={field.state.value}
                      onCheckedChange={(checked) =>
                        field.handleChange(checked === true)
                      }
                      disabled={!isCustomProvider || isSaving}
                    />
                    <Label className="font-normal">
                      {t('emailSender.form.fields.smtpSecure.description')}
                    </Label>
                  </div>
                )}
              />

              <FormField
                form={form}
                name="smtpUser"
                label={t('emailSender.form.fields.smtpUser.label')}
                description={t('emailSender.form.fields.smtpUser.description')}
                render={(field) => (
                  <Input
                    type="email"
                    value={field.state.value ?? ''}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('emailSender.form.fields.smtpUser.placeholder')}
                    disabled={isSaving}
                    className="w-full sm:col-span-2"
                  />
                )}
              />

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
                    placeholder={t('emailSender.form.fields.fromEmail.placeholder')}
                    disabled={isSaving}
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
                    placeholder={t('emailSender.form.fields.fromName.placeholder')}
                    disabled={isSaving}
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
                    placeholder={t('emailSender.form.fields.replyTo.placeholder')}
                    disabled={isSaving}
                    className="w-full sm:col-span-2"
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
                    placeholder={t('emailSender.form.fields.password.placeholder')}
                    disabled={isSaving}
                    className="w-full sm:col-span-2"
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
                <Button type="submit" disabled={isSaving}>
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
