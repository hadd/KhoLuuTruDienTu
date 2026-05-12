import { format, formatDistanceToNow } from 'date-fns'
import { enUS, vi } from 'date-fns/locale'

type SupportedLocale = 'en' | 'vi'

const locales: Record<SupportedLocale, Locale> = {
  en: enUS,
  vi,
}

const resolveLocale = (locale: SupportedLocale = 'en') =>
  locales[locale] ?? locales.en

export const formatDate = (
  date: string | number | Date,
  pattern = 'PP',
  locale: SupportedLocale = 'en',
) => {
  return format(new Date(date), pattern, { locale: resolveLocale(locale) })
}

export const formatRelativeTime = (
  date: string | number | Date,
  locale: SupportedLocale = 'en',
) => {
  return formatDistanceToNow(new Date(date), {
    locale: resolveLocale(locale),
    addSuffix: true,
  })
}
