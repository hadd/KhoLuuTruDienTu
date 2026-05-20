import type { VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { getStatusLabel } from '@/lib/constants/status'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import type { StatusValue } from '@/lib/ui/status-badge'
import { getStatusBadgeClass } from '@/lib/ui/status-badge'
import { cn } from '@/lib/utils/cn'

interface StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Status value to display. Use StatusValue type for type safety.
   * Accepts string for flexibility but StatusValue is recommended.
   */
  status: StatusValue | string | null | undefined
  /**
   * Custom label to display. If provided, overrides automatic translation from status constants.
   * Useful when you need custom translation keys (e.g., namespace-specific translations).
   */
  label?: string
  /**
   * Language code ('vi' | 'en'). If not provided, will be inferred from i18n context
   */
  lang?: 'vi' | 'en'
  /**
   * Optional object name for context-specific text mapping.
   * Allows the same status value to display different text based on context.
   * Falls back to generic status mapping if context-specific mapping doesn't exist.
   *
   * @example
   * <StatusBadge status="pending" objectName="assignment" />
   * <StatusBadge status="pending" objectName="review" />
   */
  objectName?: string
  /**
   * Whether to include border styling (default: false)
   */
  includeBorder?: boolean
  /**
   * Badge variant from shadcn/ui Badge component
   */
  variant?: VariantProps<typeof Badge>['variant']
}

/**
 * StatusBadge - Unified status badge component for all entity types
 *
 * This component provides consistent status badge styling and translations across the application.
 * It automatically handles status color mapping and i18n translations.
 *
 * @example
 * // ✅ Correct - Use StatusBadge component
 * <StatusBadge status="published" />
 * <StatusBadge status={question.status} />
 * <StatusBadge status="pending" includeBorder />
 *
 * @example
 * // ✅ Also correct - With explicit language
 * <StatusBadge status="approved" lang="en" />
 *
 * @example
 * // ✅ Also correct - With context-specific mapping
 * <StatusBadge status="pending" objectName="assignment" />
 * <StatusBadge status="pending" objectName="review" />
 *
 * @example
 * // ❌ Wrong - Don't hardcode status badge styles
 * <Badge className="bg-emerald-100 text-emerald-700">Published</Badge>
 *
 * @example
 * // ❌ Wrong - Don't create custom status badge helpers
 * const statusConfig = { color: 'bg-emerald-100' }
 * <Badge className={statusConfig.color}>Published</Badge>
 *
 * @see {@link getStatusBadgeClass} for utility function if you need classes only
 * @see {@link StatusValue} for type-safe status values
 */
export function StatusBadge({
  status,
  label: customLabel,
  lang,
  objectName,
  includeBorder = false,
  variant,
  className,
  ...props
}: StatusBadgeProps) {
  const currentLangFromHook = useCurrentLanguage()

  // Get language from prop or i18n context
  const currentLang = lang || currentLangFromHook

  // Normalize status: handle null/undefined with fallback to 'draft'
  const normalizedStatus = status || 'draft'

  // Use custom label if provided, otherwise get translated label from constants
  // Pass objectName for context-specific mapping if provided
  const label =
    customLabel ?? getStatusLabel(normalizedStatus, currentLang, objectName)

  // Get status badge classes
  const statusClasses = getStatusBadgeClass(normalizedStatus, includeBorder)

  return (
    <Badge
      variant={variant}
      className={cn('text-xs', statusClasses, className)}
      {...props}
    >
      {label}
    </Badge>
  )
}
