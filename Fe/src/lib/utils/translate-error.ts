import i18n from 'i18next'

/**
 * Translates common error messages that may come from loaders or API calls.
 * If the error message matches a known pattern, returns the translated version.
 * Otherwise, returns the original message.
 */
export function translateError(error: unknown): string {
  if (!(error instanceof Error)) {
    return i18n.t('errors.defaultDescription', { ns: 'common' })
  }

  const message = error.message

  // Map common error messages to translation keys
  const errorTranslations: Record<string, string> = {
    'School ID is required': i18n.t('errors.schoolIdRequired', {
      ns: 'common',
    }),
  }

  // Check if we have a translation for this error message
  if (errorTranslations[message]) {
    return errorTranslations[message]
  }

  // Return original message if no translation found
  return message
}
