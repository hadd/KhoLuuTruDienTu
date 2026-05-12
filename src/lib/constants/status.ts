/**
 * Status constants and utilities
 *
 * These constants define the fixed status values used throughout the application.
 * Status translations are centralized here for consistency and reusability.
 */

// Status metadata interface
interface StatusMeta {
  vi: string
  en: string
}

// Status metadata mapping
const STATUS_META: Record<string, StatusMeta> = {
  // Common statuses
  draft: { vi: 'Nháp', en: 'Draft' },
}

/**
 * Get status label based on language
 * @param status - Status value (e.g., 'draft', 'active')
 * @param lang - Language code ('vi' | 'en'), defaults to 'vi'
 * @param objectName - Optional object name for context-specific mapping (e.g., 'assignment', 'review')
 * @returns Localized label, or the status value itself if not found
 *
 * @example
 * // Generic status
 * getStatusLabel('pending', 'vi') // Returns 'Chưa nộp'
 *
 * @example
 * // Context-specific status (if mapping exists)
 * getStatusLabel('pending', 'vi', 'assignment') // Tries 'pending.assignment', falls back to 'pending'
 */
export function getStatusLabel(
  status: string | null | undefined,
  lang: 'vi' | 'en' = 'vi',
  objectName?: string,
): string {
  if (!status) return ''
  const normalizedStatus = status.toLowerCase()

  // If objectName is provided, try context-specific mapping first
  if (objectName) {
    const contextKey = `${normalizedStatus}.${objectName.toLowerCase()}`
    const contextLabel = STATUS_META[contextKey]?.[lang]
    if (contextLabel) {
      return contextLabel
    }
  }

  // Fall back to generic status mapping
  return STATUS_META[normalizedStatus]?.[lang] ?? status
}

/**
 * Get status metadata (translations for both languages)
 * @param status - Status value
 * @returns StatusMeta object with vi and en translations, or null if not found
 */
export function getStatusMeta(
  status: string | null | undefined,
): StatusMeta | null {
  if (!status) return null
  const normalizedStatus = status.toLowerCase()
  return STATUS_META[normalizedStatus] ?? null
}

/**
 * Check if a string is a valid status value
 * @param status - Status value to check
 * @returns true if status exists in STATUS_META
 */
export function isValidStatus(status: string | null | undefined): boolean {
  if (!status) return false
  const normalizedStatus = status.toLowerCase()
  return normalizedStatus in STATUS_META
}

/**
 * Get all available status values
 * @returns Array of all status keys
 */
export function getAllStatusValues(): Array<string> {
  return Object.keys(STATUS_META)
}
