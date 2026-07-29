import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
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
  onToggleAll: (input: {
    module: string
    actionKeys: string[]
    enabled: boolean
  }) => void
}

export function AuditLogConfigModuleSection({
  group,
  disabled = false,
  onToggle,
  onToggleAll,
}: AuditLogConfigModuleSectionProps) {
  const { t } = useTranslation('audit-log-config')
  const [isOpen, setIsOpen] = useState(true)

  const allEnabled = group.actions.length > 0 && group.actions.every((a) => a.enabled)

  const handleToggleAll = () => {
    onToggleAll({
      module: group.module,
      actionKeys: group.actions.map((a) => a.actionKey),
      enabled: !allEnabled,
    })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
      <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 text-lg font-medium text-foreground"
          aria-expanded={isOpen}
        >
          {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        {t(`modules.${group.module}`, { defaultValue: group.moduleLabel })}
        </button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || group.actions.length === 0}
          onClick={handleToggleAll}
        >
          {allEnabled ? t('actions.disableAll') : t('actions.enableAll')}
        </Button>
      </div>
      {isOpen ? (
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
      ) : null}
    </section>
  )
}
