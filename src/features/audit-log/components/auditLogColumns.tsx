import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/common/StatusBadge'
import { formatDate } from '@/lib/utils/date'
import type { AuditLogT } from '@/features/audit-log/types'

export function getAuditLogUserLabel(log: AuditLogT, unknownLabel: string): string {
  if (log.user?.email) return log.user.email
  if (log.user?.fullName) return log.user.fullName
  return unknownLabel
}

type HttpStatusCategory = 'success' | 'warning' | 'error'

function getHttpStatusCategory(statusCode: number): HttpStatusCategory | null {
  if (!statusCode) return null
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 300 && statusCode < 400) return 'warning'
  if (statusCode >= 400) return 'error'
  return 'warning'
}

export function AuditLogStatusCell({ statusCode }: { statusCode: number }) {
  const { t } = useTranslation('audit-log')
  const category = getHttpStatusCategory(statusCode)

  if (!category) {
    return <span className="text-muted-foreground">{t('unknown')}</span>
  }

  const statusMap = {
    success: { status: 'active' as const, label: t('httpStatus.success') },
    warning: { status: 'under_review' as const, label: t('httpStatus.warning') },
    error: { status: 'error' as const, label: t('httpStatus.error') },
  }

  const { status, label } = statusMap[category]
  return <StatusBadge status={status} label={label} />
}

export function AuditLogTimeCell({ value }: { value: string }) {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'vi' ? 'vi' : 'en'
  return <span>{formatDate(value, 'PP pp', locale)}</span>
}
