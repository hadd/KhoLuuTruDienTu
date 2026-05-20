type FormatCurrencyOptions = {
  locale?: string
  currency?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export const formatCurrency = (
  value: number,
  {
    locale = 'vi-VN',
    currency = 'VND',
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
  }: FormatCurrencyOptions = {},
) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value)
}

type FormatNumberOptions = {
  locale?: string
  maximumFractionDigits?: number
  minimumFractionDigits?: number
}

export const formatNumber = (
  value: number,
  {
    locale = 'en-US',
    maximumFractionDigits = 2,
    minimumFractionDigits = 0,
  }: FormatNumberOptions = {},
) => {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value)
}

/**
 * Formats a file size in bytes to a human-readable string (KB, MB, GB)
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string (e.g., "5.5 MB", "1.2 KB")
 */
export const formatFileSize = (
  bytes: number | null | undefined,
  decimals = 1,
): string => {
  if (bytes == null || bytes === 0) {
    return '0 B'
  }

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
