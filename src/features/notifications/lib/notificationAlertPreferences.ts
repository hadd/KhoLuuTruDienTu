export type NotificationAlertPreferencesT = {
  soundEnabled: boolean
}

const DEFAULT_PREFERENCES: NotificationAlertPreferencesT = {
  soundEnabled: true,
}

let preferences: NotificationAlertPreferencesT = { ...DEFAULT_PREFERENCES }

export function getNotificationAlertPreferences(): NotificationAlertPreferencesT {
  return preferences
}

export function setNotificationAlertPreferences(
  next: Partial<NotificationAlertPreferencesT>,
) {
  preferences = { ...preferences, ...next }
}

export function isNotificationSoundEnabled(): boolean {
  return preferences.soundEnabled
}

export function resetNotificationAlertPreferences() {
  preferences = { ...DEFAULT_PREFERENCES }
}
