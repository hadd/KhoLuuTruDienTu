import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/common/StatusBadge'
import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
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

export function IssueReportNotificationItem({
  report,
  onActivate,
  onOpenDossier,
  canOpenDossier,
}: {
  report: AdminIssueReportT
  onActivate: (report: AdminIssueReportT) => void
  onOpenDossier: (report: AdminIssueReportT) => void
  canOpenDossier: boolean
}) {
  const { t } = useTranslation('project-manager')
  const language = useCurrentLanguage()
  const canActivate = report.status === 'ESCALATED'
  const statusLabelKey = getIssueReportStatusLabelKey(report.status)

  function handleOpenDossier() {
    if (!canOpenDossier) return
    onOpenDossier(report)
  }

  return (
    <div
      className={cn(
        'border-b border-border last:border-b-0',
        canActivate && 'border-l-2 border-l-destructive',
      )}
    >
      <button
        type="button"
        className={cn(
          'w-full space-y-2 px-4 py-3 text-left transition-colors',
          canOpenDossier
            ? 'cursor-pointer hover:bg-muted/60'
            : 'cursor-default',
        )}
        onClick={handleOpenDossier}
        disabled={!canOpenDossier}
        aria-label={
          canOpenDossier ? t('issueReports.actions.openDossier') : undefined
        }
      >
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
            <TextBlock
              lines={1}
              className="text-sm font-medium text-foreground"
            >
              {report.type}
            </TextBlock>
          </div>
          {canActivate ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0"
              onClick={(event) => {
                event.stopPropagation()
                onActivate(report)
              }}
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
      </button>
    </div>
  )
}
