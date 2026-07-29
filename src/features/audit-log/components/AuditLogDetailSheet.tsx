import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { auditLogDetailQueryOptions } from '@/features/audit-log/queries'
import { AuditLogTimeCell } from '@/features/audit-log/components/auditLogColumns'
import { getAuditLogUserLabel } from '@/features/audit-log/components/auditLogColumns'
import { AuditLogStructuredDetails } from '@/features/audit-log/components/AuditLogStructuredDetails'
import { resolveAuditLogDisplay } from '@/features/audit-log/lib/deriveAuditDisplay'
import type { AuditLogT } from '@/features/audit-log/types'

type AuditLogDetailSheetProps = {
  logId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AuditLogDetailContent({ log }: { log: AuditLogT }) {
  const { t } = useTranslation('audit-log')
  const display = resolveAuditLogDisplay(log, t, t('unknown'))

  return (
    <dl className="space-y-4 text-sm">
      <div>
        <dt className="text-muted-foreground">{t('table.columns.createdAt')}</dt>
        <dd><AuditLogTimeCell value={log.createdAt} /></dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('table.columns.user')}</dt>
        <dd>{getAuditLogUserLabel(log, t('unknown'))}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('table.columns.module')}</dt>
        <dd>
          {display.module
            ? t(`modules.${display.module}`, { defaultValue: display.module })
            : t('unknown')}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('table.columns.eventType')}</dt>
        <dd>
          {display.eventType
            ? t(`events.${display.eventType}`, { defaultValue: display.eventType })
            : t('unknown')}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('table.columns.summary')}</dt>
        <dd>{display.summary}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('detail.path')}</dt>
        <dd className="break-all font-mono text-xs">{log.method} {log.path}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('detail.ip')}</dt>
        <dd>{log.ip ?? t('unknown')}</dd>
      </div>
      {log.error ? (
        <div>
          <dt className="text-muted-foreground">{t('detail.error')}</dt>
          <dd className="text-destructive">{log.error}</dd>
        </div>
      ) : null}
      <AuditLogStructuredDetails requestBody={log.requestBody} />
      {log.requestBody ? (
        <div>
          <dt className="mb-2 text-muted-foreground">{t('detail.requestBody')}</dt>
          <dd>
            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(log.requestBody, null, 2)}
            </pre>
          </dd>
        </div>
      ) : null}
    </dl>
  )
}

export function AuditLogDetailSheet({
  logId,
  open,
  onOpenChange,
}: AuditLogDetailSheetProps) {
  const { t } = useTranslation('audit-log')
  const { data: log, isLoading } = useQuery({
    ...auditLogDetailQueryOptions(logId ?? ''),
    enabled: open && Boolean(logId),
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t('detail.title')}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-1 py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('detail.loading')}</p>
          ) : !log ? (
            <p className="text-sm text-muted-foreground">{t('errors.notFound')}</p>
          ) : (
            <AuditLogDetailContent log={log} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
