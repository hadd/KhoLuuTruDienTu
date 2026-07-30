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
import { AuditLogModuleSelect } from '@/features/audit-log/components/AuditLogModuleSelect'

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
  'confirm',
  'escalate',
  'print',
  'export',
  'assign',
  'promote',
  'prepare',
  'submit',
  'verify',
  'permission_change',
  'template_change',
  'naming_change',
  'export_preset_change',
  'submit_archive',
  'approve_archive',
  'reject_archive',
  'move_file',
  'delete_file',
  'update_file',
  'place_physical',
  'move_physical',
  'remove_physical',
  'reparent',
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
      <AuditLogModuleSelect
        id="audit-log-module"
        value={module}
        onChange={onModuleChange}
      />
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
