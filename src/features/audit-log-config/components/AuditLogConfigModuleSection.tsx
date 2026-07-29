import { useTranslation } from 'react-i18next'

import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AuditLogConfigGroupT } from '@/features/audit-log-config/types'

type AuditLogConfigModuleSectionProps = {
  group: AuditLogConfigGroupT
  disabled?: boolean
  onToggle: (input: {
    module: string
    actionKey: string
    enabled: boolean
  }) => void
}

export function AuditLogConfigModuleSection({
  group,
  disabled = false,
  onToggle,
}: AuditLogConfigModuleSectionProps) {
  const { t } = useTranslation('audit-log-config')

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium text-foreground">
        {t(`modules.${group.module}`, { defaultValue: group.moduleLabel })}
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.columns.action')}</TableHead>
            <TableHead className="w-28 text-right">{t('table.columns.enabled')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.actions.map((action) => (
            <TableRow key={`${action.module}-${action.actionKey}`}>
              <TableCell>{action.label}</TableCell>
              <TableCell className="text-right">
                <Switch
                  checked={action.enabled}
                  disabled={disabled}
                  onCheckedChange={(enabled) =>
                    onToggle({
                      module: action.module,
                      actionKey: action.actionKey,
                      enabled,
                    })
                  }
                  aria-label={action.label}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
