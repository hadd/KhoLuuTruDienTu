export const SMTP_PROVIDER_OPTIONS = [
  { id: 'gmail', labelKey: 'emailSender.providers.gmail' },
  { id: 'outlook', labelKey: 'emailSender.providers.outlook' },
  { id: 'office365', labelKey: 'emailSender.providers.office365' },
  { id: 'custom', labelKey: 'emailSender.providers.custom' },
] as const

export type SmtpProviderT = (typeof SMTP_PROVIDER_OPTIONS)[number]['id']

export const SMTP_PRESETS: Record<
  Exclude<SmtpProviderT, 'custom'>,
  { host: string; port: number; secure: boolean }
> = {
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false },
  outlook: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
  office365: { host: 'smtp.office365.com', port: 587, secure: false },
}

export function inferSmtpProvider(host: string | null | undefined): SmtpProviderT {
  const normalized = host?.trim().toLowerCase() ?? ''
  if (normalized === SMTP_PRESETS.gmail.host) return 'gmail'
  if (normalized === SMTP_PRESETS.outlook.host) return 'outlook'
  if (normalized === SMTP_PRESETS.office365.host) return 'office365'
  return 'custom'
}

export function resolvePresetFields(provider: SmtpProviderT, customHost?: string) {
  if (provider === 'custom') {
    return {
      smtpHost: customHost?.trim() ?? '',
      smtpPort: 587,
      smtpSecure: false,
    }
  }
  return {
    smtpHost: SMTP_PRESETS[provider].host,
    smtpPort: SMTP_PRESETS[provider].port,
    smtpSecure: SMTP_PRESETS[provider].secure,
  }
}
