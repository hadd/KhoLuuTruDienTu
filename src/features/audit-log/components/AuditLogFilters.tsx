import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { DatePicker } from '@/components/common/date/DatePicker'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AuditLogModuleSelect } from '@/features/audit-log/components/AuditLogModuleSelect'
import { getEventOptionsForModule } from '@/features/audit-log/lib/audit-log-filter-options'
import { auditLogFilterOptionsQueryOptions } from '@/features/audit-log/queries'

type AuditLogFiltersProps = {
  dateFrom: string
  dateTo: string
  module: string
  eventType: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onModuleChange: (value: string) => void
  onEventTypeChange: (value: string) => void
  showDateRange?: boolean
  showModuleFilters?: boolean
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
  showDateRange = true,
  showModuleFilters = true,
}: AuditLogFiltersProps) {
  const { t } = useTranslation('audit-log')
  const { data: filterOptions } = useQuery(auditLogFilterOptionsQueryOptions())
  const eventOptions = getEventOptionsForModule(module, filterOptions)

  return (
    <div className="flex flex-col gap-4">
      {showDateRange ? (
        <div className="space-y-2">
          <Label>{t('filter.dateRange')}</Label>
          <div className="flex items-center gap-2">
            <DatePicker
              value={dateFrom || undefined}
              onChange={(value) => onDateFromChange(value ?? '')}
              placeholder={t('filter.dateFrom')}
              className="w-full"
            />
            <span className="text-muted-foreground">-</span>
            <DatePicker
              value={dateTo || undefined}
              onChange={(value) => onDateToChange(value ?? '')}
              placeholder={t('filter.dateTo')}
              className="w-full"
            />
          </div>
        </div>
      ) : null}
      {showModuleFilters ? (
        <>
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
                {eventOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {t(`events.${item}`, { defaultValue: item })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}
    </div>
  )
}
