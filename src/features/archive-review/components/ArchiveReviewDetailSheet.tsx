import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, FolderOpen, Loader2, Shield, UserRound, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { archiveSubmissionQueryOptions } from '@/features/archive-submission/queries'
import type { ArchiveSubmissionT } from '@/features/archive-submission/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/date'

interface ArchiveReviewDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  submission: ArchiveSubmissionT | null
  isApproving?: boolean
  isRejecting?: boolean
  onApprove: (submission: ArchiveSubmissionT) => void
  onReject: (submission: ArchiveSubmissionT) => void
}

function fieldDisplayValue(submission: ArchiveSubmissionT, fieldKey: string): string {
  const labels = submission.fieldConfigSnapshot.resolvedLabels
  if (Object.hasOwn(labels, fieldKey)) {
    return labels[fieldKey].label
  }
  const raw = submission.fieldValues[fieldKey]
  if (raw === null || raw === undefined || raw === '') return '—'
  return String(raw)
}

export function ArchiveReviewDetailSheet({
  open,
  onOpenChange,
  submission: initialSubmission,
  isApproving = false,
  isRejecting = false,
  onApprove,
  onReject,
}: ArchiveReviewDetailSheetProps) {
  const { t } = useTranslation('archive-review')
  const language = useCurrentLanguage()
  const busy = isApproving || isRejecting

  const submissionId = initialSubmission?.id ?? null
  const submissionQuery = useQuery({
    ...archiveSubmissionQueryOptions(submissionId ?? ''),
    enabled: open && Boolean(submissionId),
  })

  const submission = submissionQuery.data ?? initialSubmission

  const fields = submission
    ? [...submission.fieldConfigSnapshot.fields].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      )
    : []

  const catalogFields = fields.filter(
    (field) => field.fieldType === 'SELECT' || field.fieldType === 'REFERENCE',
  )
  const otherFields = fields.filter(
    (field) => field.fieldType !== 'SELECT' && field.fieldType !== 'REFERENCE',
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        ariaTitle={t('detail.title')}
      >
        {!submission ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SheetHeader className="space-y-3 border-b bg-muted/30 px-6 py-5 text-left">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FolderOpen className="size-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <SheetTitle className="truncate text-lg">
                    {submission.dossierName}
                  </SheetTitle>
                  <SheetDescription className="truncate font-mono text-xs">
                    {submission.folderPath}
                  </SheetDescription>
                </div>
              </div>

              <div className="grid gap-2 rounded-lg border bg-background p-3 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <UserRound className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {t('detail.submittedBy')}
                    </p>
                    <p className="truncate font-medium">
                      {submission.submitterName ?? submission.submittedBy}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('detail.submittedAt')}
                  </p>
                  <p className="font-medium">
                    {formatDate(submission.submittedAt, 'PPp', language)}
                  </p>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {catalogFields.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('detail.catalogSection')}
                  </h3>
                  <div className="space-y-2">
                    {catalogFields.map((field) => (
                      <div
                        key={field.id}
                        className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/70 py-2 last:border-b-0"
                      >
                        <span className="text-sm text-muted-foreground">
                          {field.label}
                          {field.isRequired ? (
                            <span className="text-destructive"> *</span>
                          ) : null}
                        </span>
                        <span className="max-w-[60%] text-right text-sm font-medium">
                          {fieldDisplayValue(submission, field.fieldKey)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {catalogFields.length > 0 && otherFields.length > 0 ? (
                <Separator />
              ) : null}

              {otherFields.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('detail.otherSection')}
                  </h3>
                  <div className="space-y-2">
                    {otherFields.map((field) => (
                      <div
                        key={field.id}
                        className={cn(
                          'rounded-md border bg-muted/20 px-3 py-2',
                          field.fieldType === 'TEXTAREA' && 'sm:col-span-2',
                        )}
                      >
                        <p className="text-xs text-muted-foreground">
                          {field.label}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm font-medium">
                          {fieldDisplayValue(submission, field.fieldKey)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cấp độ bảo mật đã chọn
                  </h3>
                </div>
                <div className="rounded-md border bg-muted/20 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Cấp độ bảo mật hồ sơ</span>
                    <span className="font-medium">
                      {submission.securityLevelName ?? 'Thường (mặc định)'}
                    </span>
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
                            <span className="max-w-[260px] truncate text-muted-foreground">
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
              </section>

              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('detail.noFields')}</p>
              ) : null}
            </div>

            <SheetFooter className="flex-row gap-2 border-t bg-background px-6 py-4 sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => onReject(submission)}
              >
                <XCircle className="mr-1.5 size-4" />
                {t('actions.reject')}
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={busy}
                onClick={() => onApprove(submission)}
              >
                {isApproving ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 size-4" />
                )}
                {t('actions.approve')}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
