import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import type { DataNodeType } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

const typeClass: Record<DataNodeType, string> = {
  document: 'border-blue-600/40 text-blue-700 dark:text-blue-400',
  record: 'border-amber-600/40 text-amber-800 dark:text-amber-400',
  empty_folder: 'border-border text-muted-foreground',
}

export function DataNodeTypeBadge({
  type,
  className,
}: {
  type: DataNodeType
  className?: string
}) {
  const { t } = useTranslation('data-management')
  const label = t(`nodeType.${type}` as const)

  return (
    <Badge variant="outline" className={cn('shrink-0 font-normal', typeClass[type], className)}>
      {label}
    </Badge>
  )
}
