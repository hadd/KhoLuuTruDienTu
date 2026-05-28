import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import type { DataDossierStatus } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

const statusClassName: Record<DataDossierStatus, string> = {
  NEW: 'border-gray-200 bg-gray-50 text-gray-600',
  OCR_PROCESSING: 'border-amber-200 bg-amber-50 text-amber-700',
  OCR_FAILED: 'border-red-200 bg-red-50 text-red-700',
  READY_FOR_ENTRY: 'border-sky-200 bg-sky-50 text-sky-700',
  ENTRY_PROCESSING: 'border-blue-200 bg-blue-50 text-blue-700',
  WAITING_CHECKER_1: 'border-violet-200 bg-violet-50 text-violet-700',
  CHECKER_1_PROCESSING: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  CHECKER_1_REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  WAITING_CHECKER_2: 'border-violet-200 bg-violet-50 text-violet-700',
  CHECKER_2_PROCESSING: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  CHECKER_2_REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  WAITING_CHECKER_3: 'border-violet-200 bg-violet-50 text-violet-700',
  CHECKER_3_PROCESSING: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  CHECKER_3_REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  WAITING_CHECKER_4: 'border-violet-200 bg-violet-50 text-violet-700',
  CHECKER_4_PROCESSING: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  CHECKER_4_REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  WAITING_CHECKER_5: 'border-violet-200 bg-violet-50 text-violet-700',
  CHECKER_5_PROCESSING: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  CHECKER_5_REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

export function DossierStatusBadge({
  status,
  className,
}: {
  status: DataDossierStatus
  className?: string
}) {
  const { t } = useTranslation('data-management')

  return (
    <Badge variant="outline" className={cn(statusClassName[status], className)}>
      {t(`dossierStatus.${status}`)}
    </Badge>
  )
}
