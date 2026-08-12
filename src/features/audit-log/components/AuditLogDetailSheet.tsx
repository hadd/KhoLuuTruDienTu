import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { auditLogDetailQueryOptions } from '@/features/audit-log/queries'
import {
  AuditLogStatusCell,
  AuditLogTimeCell,
  getAuditLogEntityLabel,
  getAuditLogUserLabel,
  hasMeaningfulAuditLogEntity,
} from '@/features/audit-log/components/auditLogColumns'
import { AuditLogStructuredDetails } from '@/features/audit-log/components/AuditLogStructuredDetails'
import { resolveAuditLogDisplay } from '@/features/audit-log/lib/deriveAuditDisplay'
import type { AuditLogT } from '@/features/audit-log/types'

type AuditLogDetailSheetProps = {
  logId?: string | null
  record?: AuditLogT | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{value}</dd>
    </div>
  )
}

function AuditLogDetailContent({ log }: { log: AuditLogT }) {
  const { t } = useTranslation('audit-log')
  const display = resolveAuditLogDisplay(log, t, t('unknown'))
  const moduleLabel = display.module
    ? t(`modules.${display.module}`, { defaultValue: display.module })
    : t('unknown')
  const eventLabel = display.eventType
    ? t(`events.${display.eventType}`, { defaultValue: display.eventType })
    : t('unknown')
  const requestLabel = [log.method, log.path].filter(Boolean).join(' ')

  return (
    <div className="flex max-h-[min(70vh,40rem)] flex-col gap-4 overflow-y-auto pr-1">
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed break-words">
            {display.summary}
          </p>
          <AuditLogStatusCell statusCode={log.statusCode} />
        </div>
      </div>

      <dl className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DetailField
            label={t('table.columns.createdAt')}
            value={<AuditLogTimeCell value={log.createdAt} />}
          />
          <DetailField
            label={t('table.columns.user')}
            value={getAuditLogUserLabel(log, t('unknown'))}
          />
          <DetailField label={t('table.columns.module')} value={moduleLabel} />
          <DetailField label={t('table.columns.eventType')} value={eventLabel} />
          <DetailField
            label={t('detail.ip')}
            value={
              <span className="font-mono text-xs">{log.ip ?? t('unknown')}</span>
            }
          />
          {hasMeaningfulAuditLogEntity(log) ? (
            <DetailField
              label={t('detail.entity.title')}
              value={
                <span className="flex flex-wrap items-center gap-2">
                  <span>{getAuditLogEntityLabel(log, t('unknown'))}</span>
                  {log.entityType ? (
                    <Badge variant="outline" className="font-normal">
                      {t('detail.entity.type')}: {log.entityType}
                    </Badge>
                  ) : null}
                  {log.entity && !log.entity.exists ? (
                    <Badge variant="outline" className="text-destructive">
                      {t('detail.entity.deleted')}
                    </Badge>
                  ) : null}
                </span>
              }
            />
          ) : null}
          {requestLabel ? (
            <DetailField
              label={t('detail.path')}
              value={
                <span className="block font-mono text-xs break-all">
                  {requestLabel}
                </span>
              }
            />
          ) : null}
        </div>
      </dl>
      {log.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-xs font-medium text-destructive">{t('detail.error')}</p>
          <p className="mt-1 text-sm break-words text-destructive">{log.error}</p>
        </div>
      ) : null}

      <AuditLogStructuredDetails requestBody={log.requestBody} />

      {log.requestBody ? (
        <details className="rounded-lg border border-border bg-muted/20">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            {t('detail.requestBody')}
          </summary>
          <pre className="max-h-56 overflow-auto border-t border-border px-4 py-3 text-xs leading-relaxed break-all whitespace-pre-wrap">
            {JSON.stringify(log.requestBody, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  )
}

export function AuditLogDetailSheet({
  logId,
  record,
  open,
  onOpenChange,
}: AuditLogDetailSheetProps) {
  const { t } = useTranslation('audit-log')
  const shouldFetch = open && Boolean(logId) && !record
  const { data: fetchedLog, isLoading } = useQuery({
    ...auditLogDetailQueryOptions(logId ?? ''),
    enabled: shouldFetch,
  })
  const log = record ?? fetchedLog

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden sm:max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle>{t('detail.title')}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {shouldFetch && isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !log ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('errors.notFound')}
            </p>
          ) : (
            <AuditLogDetailContent log={log} />
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('detail.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
