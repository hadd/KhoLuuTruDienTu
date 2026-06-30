import { useQuery } from '@tanstack/react-query'
import { Bell, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/common/StatusBadge'
import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getPrimaryAppRoleFromProfile } from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { getAccessToken } from '@/features/auth/store'
import { CloseIssueReportDialog } from '@/features/project-manager/components/CloseIssueReportDialog'
import { adminIssueReportsQueryOptions } from '@/features/project-manager/queries'
import type { AdminIssueReportT } from '@/features/project-manager/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/date'

function getIssueReportStatusLabelKey(
  status: AdminIssueReportT['status'],
):
  | 'issueReports.status.ESCALATED'
  | 'issueReports.status.CLOSED'
  | 'issueReports.status.PENDING'
  | 'issueReports.status.CONFIRMED'
  | 'issueReports.status.REJECTED' {
  return `issueReports.status.${status}`
}

function IssueReportNotificationItem({
  report,
  onActivate,
}: {
  report: AdminIssueReportT
  onActivate: (report: AdminIssueReportT) => void
}) {
  const { t } = useTranslation('project-manager')
  const language = useCurrentLanguage()
  const canActivate = report.status === 'ESCALATED'
  const statusLabelKey = getIssueReportStatusLabelKey(report.status)

  return (
    <div className="space-y-2 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={report.status === 'CLOSED' ? 'closed' : 'pending'}
              label={t(statusLabelKey)}
              includeBorder
            />
            <span className="text-xs text-muted-foreground">
              {formatDate(report.createdAt, 'PPp', language)}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground">
            <TextBlock lines={1}>{report.type}</TextBlock>
          </p>
        </div>
        {canActivate ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 shrink-0"
            onClick={() => onActivate(report)}
          >
            {t('issueReports.actions.confirm')}
          </Button>
        ) : null}
      </div>

      <dl className="space-y-1 text-xs">
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted-foreground">
            {t('issueReports.fields.reporterName')}:
          </dt>
          <dd className="min-w-0 text-foreground">
            <TextBlock lines={1}>
              {report.reporterName ?? t('issueReports.fields.unknownReporter')}
            </TextBlock>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted-foreground">
            {t('issueReports.fields.dossierName')}:
          </dt>
          <dd className="min-w-0 text-foreground">
            <TextBlock lines={1}>
              {report.dossierName ?? report.dossierId}
            </TextBlock>
          </dd>
        </div>
        {report.projectCode ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">
              {t('issueReports.fields.projectCode')}:
            </dt>
            <dd className="min-w-0 text-foreground">
              <TextBlock lines={1}>{report.projectCode}</TextBlock>
            </dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted-foreground">
            {t('issueReports.fields.notes')}:
          </dt>
          <dd className="min-w-0 text-foreground">
            <TextBlock lines={2}>{report.notes}</TextBlock>
          </dd>
        </div>
      </dl>
    </div>
  )
}

export function IssueReportNotificationBell() {
  const { t } = useTranslation('project-manager')
  const [open, setOpen] = useState(false)
  const [closingReport, setClosingReport] = useState<AdminIssueReportT | null>(
    null,
  )

  const { data: user } = useQuery({
    ...profileQueryOptions,
    enabled: Boolean(getAccessToken()),
  })

  const primaryAppRole = useMemo(
    () => getPrimaryAppRoleFromProfile(user),
    [user],
  )

  const canViewIssueReports =
    primaryAppRole === 'manager' || primaryAppRole === 'admin'

  const { data: reports = [], isLoading } = useQuery({
    ...adminIssueReportsQueryOptions(),
    enabled: canViewIssueReports && Boolean(getAccessToken()),
  })

  const pendingCount = useMemo(
    () => reports.filter((report) => report.status === 'ESCALATED').length,
    [reports],
  )

  if (!canViewIssueReports) {
    return null
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('issueReports.bellLabel')}
          >
            <Bell className="size-4" />
            {pendingCount > 0 ? (
              <span
                className={cn(
                  'absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground',
                )}
              >
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 p-0">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t('issueReports.title')}
            </h3>
            {pendingCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('issueReports.pendingCount', { count: pendingCount })}
              </p>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t('issueReports.empty')}
              </p>
            ) : (
              reports.map((report) => (
                <IssueReportNotificationItem
                  key={report.id}
                  report={report}
                  onActivate={(selected) => {
                    setClosingReport(selected)
                    setOpen(false)
                  }}
                />
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <CloseIssueReportDialog
        report={closingReport}
        open={closingReport !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setClosingReport(null)
          }
        }}
      />
    </>
  )
}
