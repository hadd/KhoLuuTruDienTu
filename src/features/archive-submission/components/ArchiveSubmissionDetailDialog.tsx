import { useQuery } from '@tanstack/react-query'
import { Loader2, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { archiveSubmissionQueryOptions } from '@/features/archive-submission/queries'
import type { ArchiveDossierListItemT } from '@/features/archive-submission/types'
import { computeRetentionExpiresAt } from '@/features/retention-period/lib/computeRetentionExpiresAt'
import { formatRetentionDurationLabel } from '@/features/retention-period/lib/formatRetentionDuration'
import { retentionPeriodsQueryOptions } from '@/features/retention-period/queries'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate } from '@/lib/utils/date'

const RETENTION_FIELD_KEY = 'retention_period'
const LIST_LIMIT = 200

interface ArchiveSubmissionDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossier: ArchiveDossierListItemT | null
}

export function ArchiveSubmissionDetailDialog({
  open,
  onOpenChange,
  dossier,
}: ArchiveSubmissionDetailDialogProps) {
  const { t } = useTranslation('archive-submission')
  const { t: tRetention } = useTranslation('retention-period')
  const language = useCurrentLanguage()
  const submissionId = dossier?.latestSubmission?.id ?? null

  const submissionQuery = useQuery({
    ...archiveSubmissionQueryOptions(submissionId ?? ''),
    enabled: open && Boolean(submissionId),
  })

  const retentionPeriodsQuery = useQuery({
    ...retentionPeriodsQueryOptions({ page: 1, limit: LIST_LIMIT }),
    enabled: open,
  })

  const submission = submissionQuery.data
  const retentionPeriods = retentionPeriodsQuery.data?.items ?? []
  const isArchived = dossier?.status === 'ARCHIVED'
  const isLoading = submissionQuery.isPending || retentionPeriodsQuery.isPending

  const retentionPeriodId =
    typeof submission?.fieldValues[RETENTION_FIELD_KEY] === 'string'
      ? submission.fieldValues[RETENTION_FIELD_KEY]
      : null
  const retentionPeriod = retentionPeriodId
    ? retentionPeriods.find((period) => period.id === retentionPeriodId)
    : undefined
  const retentionStartAt = submission?.reviewedAt ?? null
  const retentionExpiresAt =
    retentionPeriod && retentionStartAt
      ? computeRetentionExpiresAt(retentionStartAt, retentionPeriod)
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('detail.title')}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : submission ? (
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">{t('detail.dossierName')}</p>
                <p className="font-medium">{dossier?.name ?? submission.dossierName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('detail.submissionStatus')}</p>
                <p>{submission.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('detail.submittedAt')}</p>
                <p>{formatDate(submission.submittedAt, 'PPp', language)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('detail.submittedBy')}</p>
                <p>{submission.submitterName ?? submission.submittedBy}</p>
              </div>
            </div>

            {submission.rejectNotes ? (
              <div>
                <p className="text-muted-foreground">{t('detail.rejectNotes')}</p>
                <p className="text-destructive">{submission.rejectNotes}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="font-medium">{t('detail.fieldsTitle')}</p>
              <div className="grid gap-2 md:grid-cols-2">
                {submission.fieldConfigSnapshot.fields.map((field) => {
                  const rawValue = submission.fieldValues[field.fieldKey]
                  const resolved =
                    submission.fieldConfigSnapshot.resolvedLabels[field.fieldKey]
                  const displayValue = resolved?.label ?? String(rawValue ?? '—')

                  return (
                    <div key={field.id} className="rounded-md border px-3 py-2">
                      <p className="text-xs text-muted-foreground">{field.label}</p>
                      <p>{displayValue}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2 rounded-md border bg-muted/20 p-4">
              <div className="flex items-center gap-2 font-medium">
                <Shield className="size-4 text-primary" />
                <span>Cấp độ bảo mật đã chọn</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Cấp độ bảo mật hồ sơ</p>
                  <p className="font-medium">{submission.securityLevelName ?? 'Thường (mặc định)'}</p>
                </div>
              </div>

              {submission.files && submission.files.length > 0 ? (
                <div className="mt-3 space-y-1.5 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Cấp độ bảo mật từng file PDF ({submission.files.length} file)
                  </p>
                  <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                    {submission.files.map((file) => (
                      <div
                        key={file.fileId}
                        className="flex items-center justify-between rounded border bg-background px-2.5 py-1.5 text-xs"
                      >
                        <span className="max-w-[280px] truncate text-muted-foreground">
                          {file.fileName}
                        </span>
                        <Badge variant="outline" className="shrink-0 text-xs font-normal">
                          {file.securityLevelName ?? 'Theo hồ sơ'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {isArchived && retentionPeriod ? (
              <div className="space-y-2 rounded-md border bg-muted/20 p-4">
                <p className="font-medium">{t('detail.retention.title')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">
                      {t('detail.retention.duration')}
                    </p>
                    <p>{formatRetentionDurationLabel(retentionPeriod, tRetention)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {t('detail.retention.startAt')}
                    </p>
                    <p>
                      {retentionStartAt
                        ? formatDate(retentionStartAt, 'PP', language)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {t('detail.retention.expiresAt')}
                    </p>
                    <p>
                      {retentionPeriod.isPermanent
                        ? t('detail.retention.permanent')
                        : retentionExpiresAt
                          ? formatDate(retentionExpiresAt, 'PP', language)
                          : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('detail.loadFailed')}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
