import type {
  EmailConfigStatusT,
  NotificationChannelT,
  NotificationConfigT,
} from '@/features/notification-config/types'

export function canActivateNotificationConfig(
  config: NotificationConfigT,
  emailStatus: EmailConfigStatusT | undefined,
): boolean {
  if (!config.channels.includes('email')) return true
  return emailStatus?.configured === true
}

export function showEmailChannelWarning(
  channels: Array<NotificationChannelT>,
  emailStatus: EmailConfigStatusT | undefined,
): boolean {
  return channels.includes('email') && emailStatus?.configured !== true
}

export function getActivateDisabledReasonKey(
  config: NotificationConfigT,
  emailStatus: EmailConfigStatusT | undefined,
): 'activateEmailNotReady' | 'activateInfraMissing' | null {
  if (!config.channels.includes('email') || config.active) return null
  if (emailStatus?.missingFields.includes('SMTP_HOST')) {
    return 'activateInfraMissing'
  }
  if (!emailStatus?.configured) {
    return 'activateEmailNotReady'
  }
  return null
}
