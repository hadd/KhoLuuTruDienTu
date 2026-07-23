import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Inbox, Loader2, PlayCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useOcrControlAccess } from '@/features/ocr-control/hooks/useOcrControlAccess'
import {
  pendingManualDossiersQueryOptions,
  useTriggerManualOcrMutation,
} from '@/features/ocr-control/queries'
import type { OcrPendingDossierT } from '@/features/ocr-control/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

export function OcrControlPage() {
  const { t } = useTranslation('ocr-control')
  const language = useCurrentLanguage()
  const { canTriggerOcr } = useOcrControlAccess()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_LIMIT)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const { data, isPending, isFetching } = useQuery(
    pendingManualDossiersQueryOptions({ page, pageSize }),
  )
  const triggerMutation = useTriggerManualOcrMutation()

  const items = data?.items ?? []
  const totalDossiers = data?.totalDossiers ?? 0
  const totalPages = Math.max(1, Math.ceil(totalDossiers / pageSize))

  function toggleSelected(dossierId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(dossierId)
      else next.delete(dossierId)
      return next
    })
  }

  function toggleExpanded(dossierId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(dossierId)) next.delete(dossierId)
      else next.add(dossierId)
      return next
    })
  }

  async function handleTrigger(dossierIds: Array<string>) {
    if (dossierIds.length === 0) return
    try {
      const result = await triggerMutation.mutateAsync(dossierIds)
      const succeeded = result.results.filter((r) => r.success)
      const failed = result.results.filter((r) => !r.success)

      if (succeeded.length > 0) {
        toast.success(t('toast.triggerSuccess', { count: succeeded.length }))
      }
      if (failed.length > 0) {
        toast.error(t('toast.triggerFailed', { count: failed.length }))
      }

      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of dossierIds) next.delete(id)
        return next
      })
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  const queueBadge =
    data != null ? (
      <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
        <Inbox className="size-3.5" />
        {t('queue.count', { count: totalDossiers })}
        {isFetching ? <Loader2 className="size-3 animate-spin" /> : null}
      </div>
    ) : null

  const selectedCount = selectedIds.size

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-3">
          {queueBadge}
          {canTriggerOcr && selectedCount > 0 ? (
            <Button
              type="button"
              size="sm"
              disabled={triggerMutation.isPending}
              onClick={() => void handleTrigger(Array.from(selectedIds))}
            >
              {triggerMutation.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-1.5 size-4" />
              )}
              {t('actions.runSelected', { count: selectedCount })}
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden" variant="list">
        {isPending && items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {!isPending && items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t('empty.noDossiersPending')}</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {t('empty.noDossiersPendingHint')}
            </p>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  {canTriggerOcr ? <TableHead className="w-10" /> : null}
                  <TableHead className="w-8" />
                  <TableHead>{t('columns.dossierName')}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('columns.folderPath')}
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t('columns.project')}
                  </TableHead>
                  <TableHead>{t('columns.pendingFileCount')}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t('columns.oldestPendingAt')}
                  </TableHead>
                  <TableHead className="w-[140px] text-right">
                    {t('columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((dossier: OcrPendingDossierT) => {
                  const isExpanded = expandedIds.has(dossier.dossierId)
                  const isSelected = selectedIds.has(dossier.dossierId)
                  const isTriggeringThis =
                    triggerMutation.isPending &&
                    triggerMutation.variables?.includes(dossier.dossierId)

                  return (
                    <>
                      <TableRow key={dossier.dossierId}>
                        {canTriggerOcr ? (
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                toggleSelected(dossier.dossierId, checked === true)
                              }
                            />
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() => toggleExpanded(dossier.dossierId)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium leading-tight">
                            {dossier.dossierName}
                          </p>
                        </TableCell>
                        <TableCell className="hidden max-w-[280px] truncate font-mono text-xs text-muted-foreground md:table-cell">
                          {dossier.folderPath}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {dossier.projectCode ? (
                            <Badge variant="secondary">{dossier.projectCode}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{dossier.pendingFileCount}</Badge>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                          {formatDate(dossier.oldestPendingAt, 'PP', language)}
                        </TableCell>
                        <TableCell className="text-right">
                          {canTriggerOcr ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={triggerMutation.isPending}
                              onClick={() =>
                                void handleTrigger([dossier.dossierId])
                              }
                            >
                              {isTriggeringThis ? (
                                <Loader2 className="mr-1 size-3.5 animate-spin" />
                              ) : (
                                <PlayCircle className="mr-1 size-3.5" />
                              )}
                              {t('actions.run')}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow key={`${dossier.dossierId}-details`}>
                          <TableCell
                            colSpan={canTriggerOcr ? 8 : 7}
                            className="bg-muted/30"
                          >
                            <ul className="flex flex-col gap-1 py-1 text-xs text-muted-foreground">
                              {dossier.pendingFiles.map((file) => (
                                <li
                                  key={file.id}
                                  className="flex items-center justify-between gap-3 truncate font-mono"
                                >
                                  <span className="truncate">{file.filePath}</span>
                                  <span className="shrink-0">
                                    {formatDate(file.createdAt, 'PPp', language)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </Card>

      {items.length > 0 ? (
        <div className="mt-auto shrink-0">
          <ListPagePagination
            page={page}
            totalPages={totalPages}
            limit={pageSize}
            pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onLimitChange={(nextLimit) => {
              setPageSize(nextLimit)
              setPage(1)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
