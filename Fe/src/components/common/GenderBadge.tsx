import type { VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import type { GenderKey } from '@/lib/constants/categories'
import {
  getCategoryBadgeClasses,
  getGenderLabel,
} from '@/lib/constants/categories'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { cn } from '@/lib/utils/cn'

interface GenderBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Gender value to display ('male' | 'female' | 'other')
   */
  gender: 'male' | 'female' | 'other' | string | null | undefined
  /**
   * Language code ('vi' | 'en'). If not provided, will be inferred from i18n context
   */
  lang?: 'vi' | 'en'
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
 * GenderBadge - Unified gender badge component
 *
 * This component provides consistent gender badge styling and translations across the application.
 * It automatically handles i18n translations for gender values.
 *
 * @example
 * // ✅ Correct - Use GenderBadge component
 * <GenderBadge gender="male" />
 * <GenderBadge gender={student.gender} />
 * <GenderBadge gender="female" includeBorder />
 *
 * @example
 * // ✅ Also correct - With explicit language
 * <GenderBadge gender="male" lang="en" />
 *
 * @example
 * // ❌ Wrong - Don't hardcode gender badge styles
 * <Badge className="bg-blue-100 text-blue-700">Nam</Badge>
 */
export function GenderBadge({
  gender,
  lang,
  includeBorder = false,
  variant,
  className,
  ...props
}: GenderBadgeProps) {
  const currentLangFromHook = useCurrentLanguage()

  // Get language from prop or i18n context
  const currentLang = lang || currentLangFromHook

  // If no gender, return null
  if (!gender) {
    return null
  }

  // Get translated label from category constants
  const label = getGenderLabel(gender as GenderKey, currentLang)

  // Get badge classes from category constants
  const badgeClasses = getCategoryBadgeClasses(
    'gender',
    gender as GenderKey,
    includeBorder,
  )

  return (
    <Badge
      variant={variant}
      className={cn('text-xs', badgeClasses, className)}
      {...props}
    >
      {label}
    </Badge>
  )
}
