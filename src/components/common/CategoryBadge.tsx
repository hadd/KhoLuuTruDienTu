// import type { VariantProps } from 'class-variance-authority'
// import * as React from 'react'

// import { Badge } from '@/components/ui/badge'
// import type { GradeKey, LevelKey, SubjectKey } from '@/lib/constants/categories'
// import {
//   getCategoryBadgeClasses,
//   getGradeLabel,
//   getLevelLabel,
//   getSubjectLabel,
// } from '@/lib/constants/categories'
// import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
// import { cn } from '@/lib/utils/cn'

// interface CategoryBadgeProps
//   extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
//   /**
//    * Category type to display
//    */
//   type: 'grade' | 'subject' | 'level'
//   /**
//    * Category value to display (e.g., 'lop-10', 'toan', 'easy')
//    */
//   value: GradeKey | SubjectKey | LevelKey | string | null | undefined
//   /**
//    * Language code ('vi' | 'en'). If not provided, will be inferred from i18n context
//    */
//   lang?: 'vi' | 'en'
//   /**
//    * Whether to include border styling (default: false)
//    */
//   includeBorder?: boolean
//   /**
//    * Badge variant from shadcn/ui Badge component
//    */
//   variant?: VariantProps<typeof Badge>['variant']
// }

// /**
//  * CategoryBadge - Unified category badge component for grade/subject/level values
//  *
//  * This component provides consistent category badge styling and translations across the application.
//  * It automatically handles category color mapping and i18n translations.
//  *
//  * @example
//  * // ✅ Correct - Use CategoryBadge component
//  * <CategoryBadge type="grade" value="lop-10" />
//  * <CategoryBadge type="subject" value={course.subject} />
//  * <CategoryBadge type="level" value="easy" includeBorder />
//  *
//  * @example
//  * // ✅ Also correct - With explicit language
//  * <CategoryBadge type="grade" value="lop-10" lang="en" />
//  *
//  * @example
//  * // ❌ Wrong - Don't hardcode category badge styles
//  * <Badge className="bg-emerald-100 text-emerald-700">Lớp 10</Badge>
//  *
//  * @example
//  * // ❌ Wrong - Don't create custom category badge helpers
//  * const gradeConfig = { color: 'bg-emerald-100' }
//  * <Badge className={gradeConfig.color}>Lớp 10</Badge>
//  */
// export function CategoryBadge({
//   type,
//   value,
//   lang,
//   includeBorder = false,
//   variant,
//   className,
//   ...props
// }: CategoryBadgeProps) {
//   const currentLangFromHook = useCurrentLanguage()

//   // Get language from prop or i18n context
//   const currentLang = lang || currentLangFromHook

//   // Get label based on type
//   let label = ''
//   if (value) {
//     switch (type) {
//       case 'grade':
//         label = getGradeLabel(value as GradeKey, currentLang)
//         break
//       case 'subject':
//         label = getSubjectLabel(value as SubjectKey, currentLang)
//         break
//       case 'level':
//         label = getLevelLabel(value as LevelKey, currentLang)
//         break
//     }
//   }

//   // If no label, return null or empty badge
//   if (!label) {
//     return null
//   }

//   // Get category badge classes
//   const badgeClasses = getCategoryBadgeClasses(type, value, includeBorder)

//   return (
//     <Badge
//       variant={variant}
//       className={cn('text-xs', badgeClasses, className)}
//       {...props}
//     >
//       {label}
//     </Badge>
//   )
// }
