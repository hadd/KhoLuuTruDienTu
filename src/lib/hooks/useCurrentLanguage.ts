import { useTranslation } from 'react-i18next'

/**
 * Hook to get the current language code
 * @returns 'vi' | 'en' based on i18n language setting
 *
 * @example
 * const lang = useCurrentLanguage()
 * const label = getStatusLabel('active', lang)
 */
export function useCurrentLanguage(): 'vi' | 'en' {
  const { i18n } = useTranslation()
  return i18n.language === 'vi' ? 'vi' : 'en'
}
