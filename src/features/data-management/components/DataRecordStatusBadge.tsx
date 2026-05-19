import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import type { DataRecordStatus } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

const statusClassName: Record<DataRecordStatus, string> = {
  pendingOcr: 'border-amber-200 bg-amber-50 text-amber-700',
  edited: 'border-blue-200 bg-blue-50 text-blue-700',
  pendingApproval: 'border-violet-200 bg-violet-50 text-violet-700',
  approved1: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  approved2: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  final: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

export function DataRecordStatusBadge({
  status,
  className,
}: {
  status: DataRecordStatus
  className?: string
}) {
  const { t } = useTranslation('data-management')

  return (
    <Badge variant="outline" className={cn(statusClassName[status], className)}>
      {t(`recordStatus.${status}`)}
    </Badge>
  )
}
