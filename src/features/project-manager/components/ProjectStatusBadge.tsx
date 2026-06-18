import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import type { ProjectStatusT } from '@/features/project-manager/types'
import { cn } from '@/lib/utils/cn'

const statusClassName: Record<ProjectStatusT, string> = {
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  EXTENDED: 'border-amber-200 bg-amber-50 text-amber-700',
  ACCEPTED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  SUSPENDED: 'border-violet-200 bg-violet-50 text-violet-700',
  CANCELLED: 'border-red-200 bg-red-50 text-red-700',
}

const fallbackClassName = 'border-gray-200 bg-gray-50 text-gray-600'

function isProjectStatus(status: string): status is ProjectStatusT {
  return status in statusClassName
}

export function ProjectStatusBadge({
  status,
  className,
}: {
  status: ProjectStatusT | string
  className?: string
}) {
  const { t } = useTranslation('project-manager')
  const badgeClassName = isProjectStatus(status)
    ? statusClassName[status]
    : fallbackClassName

  return (
    <Badge variant="outline" className={cn(badgeClassName, className)}>
      {t(`status.${status}`, { defaultValue: status })}
    </Badge>
  )
}
