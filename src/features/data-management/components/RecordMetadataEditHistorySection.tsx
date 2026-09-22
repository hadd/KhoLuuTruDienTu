import { ArrowDownAZ, ArrowUpAZ, FileText, Loader2, RotateCcw, Files } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  DataMetadataEditBatchT,
  DataMetadataEditFieldChangeT,
  DataMetadataHistoryFileRefT,
} from '@/features/data-management/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/date'

type SortOrder = 'asc' | 'desc'

function resolveActionLabel(
  action: string | null | undefined,
  t: (key: string) => string,
): string | null {
  if (!action) return null

  const key = `recordDetail.editHistory.actions.${action}`
  const translated = t(key)
  return translated === key ? action : translated
}

function MetadataEditFieldChangeRow({
  change,
  isHighlighted,
  onActivate,
}: {
  change: DataMetadataEditFieldChangeT
  isHighlighted: boolean
  onActivate: (change: DataMetadataEditFieldChangeT) => void
}) {
  const { t } = useTranslation('data-management')

  return (
    <div
      className={cn(
        'rounded-md border border-border p-2 transition-colors',
        isHighlighted && 'border-primary bg-accent/30',
      )}
    >
      <button
        type="button"
        className={cn(
          'w-full text-left text-sm font-medium cursor-pointer text-foreground hover:underline underline-offset-2',
          isHighlighted && 'text-primary',
        )}
        onClick={() => onActivate(change)}
        aria-label={t('recordDetail.viewFieldInPdf')}
      >
        {change.fieldDisplay}
      </button>
      <div className="mt-2 grid gap-1 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {t('recordDetail.editHistory.oldValue')}
          </p>
          <p className="truncate text-foreground">
            {change.oldValue.trim() || '—'}
          </p>
        </div>
        <span className="hidden text-muted-foreground sm:inline">→</span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {t('recordDetail.editHistory.newValue')}
          </p>
          <p className="truncate font-medium text-foreground">
            {change.newValue.trim() || '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

export function RecordMetadataEditHistorySection({
  batches,
  highlightedChangeId,
  isLoading = false,
  isError = false,
  isRestoring = false,
  restoringBatchId = null,
  onFieldActivate,
  onFileActivate,
  onRevertBatch,
}: {
  batches: Array<DataMetadataEditBatchT>
  highlightedChangeId: string | null
  isLoading?: boolean
  isError?: boolean
  isRestoring?: boolean
  restoringBatchId?: string | null
  onFieldActivate: (change: DataMetadataEditFieldChangeT) => void
  onFileActivate?: (file: DataMetadataHistoryFileRefT) => void
  onRevertBatch: (batch: DataMetadataEditBatchT) => void
}) {
  const { t } = useTranslation('data-management')
  const language = useCurrentLanguage()
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const sortedBatches = useMemo(() => {
    const next = [...batches].map((batch) => {
      const filteredFiles = batch.files.filter((file) => {
        const name = (file.fileName || '').trim().toLowerCase()
        return name && !name.endsWith('.json')
      })
      return { ...batch, files: filteredFiles }
    })
    next.sort((left, right) => {
      const leftTime = new Date(left.editedAt).getTime()
      const rightTime = new Date(right.editedAt).getTime()
      return sortOrder === 'desc' ? rightTime - leftTime : leftTime - rightTime
    })
    return next
  }, [batches, sortOrder])

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-border bg-muted/20 p-6">
        <Loader2
          className="size-5 animate-spin text-muted-foreground"
          aria-hidden
        />
        <span className="sr-only">{t('recordDetail.editHistory.loading')}</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-border bg-muted/20 p-6">
        <p className="text-center text-sm text-muted-foreground">
          {t('recordDetail.editHistory.loadError')}
        </p>
      </div>
    )
  }

  if (batches.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-border bg-muted/20 p-6">
        <p className="text-center text-sm text-muted-foreground">
          {t('recordDetail.editHistory.empty')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">
          {t('recordDetail.editHistory.title')}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
          }
          aria-label={
            sortOrder === 'desc'
              ? t('recordDetail.editHistory.sortNewestFirst')
              : t('recordDetail.editHistory.sortOldestFirst')
          }
        >
          {sortOrder === 'desc' ? (
            <ArrowDownAZ className="size-3.5" aria-hidden />
          ) : (
            <ArrowUpAZ className="size-3.5" aria-hidden />
          )}
          {sortOrder === 'desc'
            ? t('recordDetail.editHistory.sortNewestFirst')
            : t('recordDetail.editHistory.sortOldestFirst')}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
        <div className="grid gap-3 p-3">
          {sortedBatches.map((batch) => {
            const actionLabel = resolveActionLabel(batch.action, t)
            const editorName =
              batch.editorName.trim() ||
              t('recordDetail.editHistory.systemActor')
            const isBatchRestoring =
              isRestoring && restoringBatchId === batch.id

            return (
              <Card key={batch.id} variant="bordered">
                <CardHeader className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      {batch.files.length > 0 ? (
                        <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                          <Files
                            className="size-3.5 shrink-0"
                            aria-hidden
                          />
                          <span>
                            {t('recordDetail.editHistory.fileChangesLabel')}:{' '}
                            {batch.files.length}{' '}
                            {batch.files.length === 1 ? 'tài liệu' : 'tài liệu'}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {t('recordDetail.editHistory.fileNameLabel')}: —
                        </p>
                      )}
                      <CardTitle className="text-sm font-medium">
                        {editorName}
                      </CardTitle>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>{formatDate(batch.editedAt, 'PPp', language)}</p>
                        {actionLabel ? (
                          <p>
                            {t('recordDetail.editHistory.actionLabel')}:{' '}
                            {actionLabel}
                          </p>
                        ) : null}
                        {batch.versionNumber != null ? (
                          <p>
                            {t('recordDetail.editHistory.versionLabel')}:{' '}
                            {batch.versionNumber}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      disabled={isRestoring}
                      onClick={() => onRevertBatch(batch)}
                    >
                      {isBatchRestoring ? (
                        <Loader2
                          className="size-3.5 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <RotateCcw className="size-3.5" aria-hidden />
                      )}
                      {t('recordDetail.editHistory.revert')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pb-4">
                  {batch.files.length > 0
                    ? batch.files.map((file, fileIndex) => {
                        const canFocus =
                          Boolean(onFileActivate) &&
                          (Boolean(file.documentId) || file.groupIndex >= 0)
                        const fileBlockKey = `${batch.id}-${file.documentId ?? file.fileName}-${file.groupIndex}-${fileIndex}`

                        return (
                          <div
                            key={fileBlockKey}
                            className="space-y-2 rounded-lg border border-border bg-muted/10 p-2.5"
                          >
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">
                                {t('recordDetail.editHistory.fileNameLabel')}
                              </p>
                              <button
                                type="button"
                                className={cn(
                                  'flex max-w-full items-center gap-1.5 text-left text-sm font-medium',
                                  canFocus
                                    ? 'cursor-pointer text-primary underline-offset-2 hover:underline'
                                    : 'cursor-default text-foreground',
                                )}
                                onClick={() => {
                                  if (!canFocus) return
                                  onFileActivate?.(file)
                                }}
                                disabled={!canFocus}
                                title={file.fileName}
                                aria-label={t(
                                  'recordDetail.editHistory.fileChangesHint',
                                )}
                              >
                                <FileText
                                  className="size-3.5 shrink-0"
                                  aria-hidden
                                />
                                <span className="min-w-0 truncate">
                                  {file.fileName.trim() || '—'}
                                </span>
                              </button>
                            </div>
                            {file.fileChanges.length > 0 ? (
                              <div className="space-y-2">
                                <p className="pt-1 text-xs font-medium text-muted-foreground">
                                  {t(
                                    'recordDetail.editHistory.metadataChangesLabel',
                                  )}
                                </p>
                                {file.fileChanges.map((change) => (
                                  <MetadataEditFieldChangeRow
                                    key={change.id}
                                    change={change}
                                    isHighlighted={
                                      highlightedChangeId === change.id
                                    }
                                    onActivate={onFieldActivate}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )
                      })
                    : null}
                  {batch.dossierLevelChanges.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('recordDetail.editHistory.metadataChangesLabel')}
                      </p>
                      {batch.dossierLevelChanges.map((change) => (
                        <MetadataEditFieldChangeRow
                          key={change.id}
                          change={change}
                          isHighlighted={highlightedChangeId === change.id}
                          onActivate={onFieldActivate}
                        />
                      ))}
                    </div>
                  ) : batch.files.length === 0 && batch.changes.length > 0 ? (
                    <>
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('recordDetail.editHistory.metadataChangesLabel')}
                      </p>
                      {batch.changes.map((change) => (
                        <MetadataEditFieldChangeRow
                          key={change.id}
                          change={change}
                          isHighlighted={highlightedChangeId === change.id}
                          onActivate={onFieldActivate}
                        />
                      ))}
                    </>
                  ) : batch.notes?.trim() ? (
                    <p className="text-sm text-foreground">{batch.notes}</p>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
