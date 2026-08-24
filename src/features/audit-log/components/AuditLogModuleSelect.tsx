import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AUDIT_LOG_MODULE_OPTIONS } from '@/features/audit-log/lib/audit-log-modules'

type AuditLogModuleSelectProps = {
  value: string
  onChange: (value: string) => void
  id?: string
  allowedModules?: string[]
}

export function AuditLogModuleSelect({
  value,
  onChange,
  id,
  allowedModules,
}: AuditLogModuleSelectProps) {
  const { t } = useTranslation('audit-log')

  const options = allowedModules
    ? AUDIT_LOG_MODULE_OPTIONS.filter((item) => allowedModules.includes(item))
    : AUDIT_LOG_MODULE_OPTIONS

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t('filter.module')}</Label>
      <Select
        value={value || 'all'}
        onValueChange={(next) => onChange(next === 'all' ? '' : next)}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={t('filter.modulePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter.all')}</SelectItem>
          {options.map((item) => (
            <SelectItem key={item} value={item}>
              {t(`modules.${item}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

