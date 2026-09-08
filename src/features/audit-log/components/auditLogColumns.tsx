import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/common/StatusBadge'
import { formatDate } from '@/lib/utils/date'
import type { AuditLogT } from '@/features/audit-log/types'

export function isSystemAutomatedLog(log: AuditLogT): boolean {
  if (log.userId) return false

  const eventType = (log.eventType ?? '').toLowerCase()
  const summary = (log.summary ?? '').toLowerCase()

  // Các eventType tác vụ chạy ngầm của hệ thống
  if (
    eventType === 'expire_borrow' ||
    eventType === 'auto_reject_borrow' ||
    eventType.startsWith('auto_') ||
    eventType.startsWith('cron_') ||
    eventType.startsWith('purge_') ||
    eventType.startsWith('system_')
  ) {
    return true
  }

  // Các module worker hệ thống
  if (log.module === 'system-cron' || log.module === 'system_worker') {
    return true
  }

  // Từ khóa mô tả tác vụ tự động
  if (
    summary.includes('hết hạn phiếu mượn') ||
    summary.includes('tự động từ chối') ||
    summary.includes('tự động dọn dẹp') ||
    summary.includes('tự động đồng bộ') ||
    summary.includes('tự động ocr') ||
    summary.includes('hệ thống tự động') ||
    summary.includes('tự động xử lý') ||
    summary.includes('auto-rejected') ||
    summary.includes('auto-expired') ||
    summary.includes('scheduled purge') ||
    summary.includes('purge expired')
  ) {
    return true
  }

  return false
}

export function getAuditLogUserLabel(
  log: AuditLogT,
  unknownLabel: string,
  systemLabel: string = 'Hệ thống',
): string {
  if (log.user?.email) return log.user.email
  if (log.user?.fullName) return log.user.fullName

  // Tác vụ tự động ngầm của hệ thống -> "Hệ thống"
  if (isSystemAutomatedLog(log)) {
    return systemLabel
  }

  // Mặc định đăng nhập thất bại / user đã bị xóa -> "Không xác định"
  return unknownLabel
}

export function getAuditLogEntityLabel(log: AuditLogT, unknownLabel: string): string {
  const label = log.entity?.label ?? log.entityLabel
  if (!label || label === log.entityId) return unknownLabel
  return label
}

export function hasMeaningfulAuditLogEntity(log: AuditLogT): boolean {
  const label = log.entity?.label ?? log.entityLabel
  return Boolean(label && label !== log.entityId)
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

export function AuditLogTimeCell({
  value,
  compact = false,
}: {
  value: string
  compact?: boolean
}) {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'vi' ? 'vi' : 'en'
  return (
    <span>
      {formatDate(value, compact ? 'dd/MM/yyyy HH:mm' : 'PP pp', locale)}
    </span>
  )
}
