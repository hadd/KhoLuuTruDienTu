import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const MODULE_OPTIONS = [
  'auth',
  'fonds',
  'retention-periods',
  'archive',
  'data-entry',
  'users',
  'roles',
  'watermark',
  'metadata',
] as const

const EVENT_OPTIONS = [
  'login',
  'login_failed',
  'logout',
  'view',
  'create',
  'update',
  'delete',
  'edit',
  'approve',
  'reject',
  'print',
  'permission_change',
] as const

type AuditLogFiltersProps = {
  dateFrom: string
  dateTo: string
  module: string
  eventType: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onModuleChange: (value: string) => void
  onEventTypeChange: (value: string) => void
}

export function AuditLogFilters({
  dateFrom,
  dateTo,
  module,
  eventType,
  onDateFromChange,
  onDateToChange,
  onModuleChange,
  onEventTypeChange,
}: AuditLogFiltersProps) {
  const { t } = useTranslation('audit-log')

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="audit-log-date-from">{t('filter.dateFrom')}</Label>
        <Input
          id="audit-log-date-from"
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="audit-log-date-to">{t('filter.dateTo')}</Label>
        <Input
          id="audit-log-date-to"
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('filter.module')}</Label>
        <Select
          value={module || 'all'}
          onValueChange={(value) =>
            onModuleChange(value === 'all' ? '' : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('filter.modulePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filter.all')}</SelectItem>
            {MODULE_OPTIONS.map((item) => (
              <SelectItem key={item} value={item}>
                {t(`modules.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t('filter.eventType')}</Label>
        <Select
          value={eventType || 'all'}
          onValueChange={(value) =>
            onEventTypeChange(value === 'all' ? '' : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('filter.eventTypePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filter.all')}</SelectItem>
            {EVENT_OPTIONS.map((item) => (
              <SelectItem key={item} value={item}>
                {t(`events.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
