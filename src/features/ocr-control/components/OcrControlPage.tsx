import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  FolderUp,
  Inbox,
  Loader2,
  PlayCircle,
  Settings2,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { DigitizationSubPageShell } from '@/features/digitization/components/DigitizationSubPageShell'
import { useDataManagementHubAccess } from '@/features/digitization/hooks/useDataManagementHubAccess'
import { FolderUploadDialog } from '@/features/data-management/components/FolderUploadDialog'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import { resolveDataManagementRole } from '@/features/data-management/lib/resolveDataManagementRole'
import { useAdminProjectCode } from '@/features/data-management/store'
import { useOcrControlAccess } from '@/features/ocr-control/hooks/useOcrControlAccess'
import { useMetadataExtractSettingsAccess } from '@/features/metadata-extract/hooks/useMetadataExtractSettingsAccess'
import { useOcrControlSocket } from '@/features/ocr-control/hooks/useOcrControlSocket'
import {
  pendingManualDossiersQueryKeyPrefix,
  pendingManualDossiersQueryOptions,
  trackedManualDossiersQueryOptions,
  useTriggerManualOcrMutation,
} from '@/features/ocr-control/queries'
import type {
  OcrPendingDossierT,
  OcrTrackedDossierT,
  OcrTrackedUiStatusT,
} from '@/features/ocr-control/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

type OcrControlFilterT = 'all' | 'pending' | OcrTrackedUiStatusT

type OcrControlRowT =
  | { kind: 'pending'; dossier: OcrPendingDossierT }
  | { kind: 'tracked'; dossier: OcrTrackedDossierT }

function formatElapsedSince(isoDate: string): string {
  const started = new Date(isoDate).getTime()
  if (Number.isNaN(started)) return '—'
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function OcrProgressBar({
  uiStatus,
  label,
}: {
  uiStatus: OcrTrackedUiStatusT
  label: string
}) {
  const percent =
    uiStatus === 'completed' ? 100 : uiStatus === 'failed' ? 0 : null

  return (
    <div className="flex min-w-[120px] flex-col gap-1">
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        {percent != null ? (
          <div
            className={cn(
              'h-full rounded-full transition-all',
              uiStatus === 'completed' ? 'bg-emerald-500' : 'bg-red-400',
            )}
            style={{ width: `${percent}%` }}
          />
        ) : (
          <div className="h-full w-2/3 animate-pulse rounded-full bg-amber-400" />
        )}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function OcrRowStatusBadge({
  status,
}: {
  status: 'pending' | OcrTrackedUiStatusT
}) {
  const { t } = useTranslation('ocr-control')

  const config = {
    pending: {
      icon: Inbox,
      className: 'border-slate-200 bg-slate-50 text-slate-700',
      spin: false,
    },
    processing: {
      icon: Loader2,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      spin: true,
    },
    completed: {
      icon: CheckCircle2,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      spin: false,
    },
    failed: {
      icon: XCircle,
      className: 'border-red-200 bg-red-50 text-red-700',
      spin: false,
    },
  }[status]

  const Icon = config.icon

  return (
    <Badge variant="outline" className={cn('gap-1', config.className)}>
      <Icon className={cn('size-3', config.spin && 'animate-spin')} />
      {t(`status.${status}`)}
    </Badge>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'muted' | 'slate' | 'amber' | 'emerald' | 'red'
}) {
  const toneClass = {
    muted: 'border-border bg-muted/30 text-foreground',
    slate: 'border-slate-200 bg-slate-50/60 text-slate-800',
    amber: 'border-amber-200 bg-amber-50/60 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-800',
    red: 'border-red-200 bg-red-50/60 text-red-800',
  }[tone]

  return (
    <div className={cn('rounded-lg border px-4 py-3', toneClass)}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function getRowSortTime(row: OcrControlRowT): number {
  if (row.kind === 'pending') {
    return new Date(row.dossier.oldestPendingAt).getTime()
  }
  return new Date(row.dossier.latestTriggeredAt).getTime()
}

function sortMergedRows(rows: Array<OcrControlRowT>): Array<OcrControlRowT> {
  const statusPriority: Record<string, number> = {
    processing: 0,
    pending: 1,
    failed: 2,
    completed: 3,
  }

  return [...rows].sort((a, b) => {
    const statusA = a.kind === 'pending' ? 'pending' : a.dossier.uiStatus
    const statusB = b.kind === 'pending' ? 'pending' : b.dossier.uiStatus
    const priorityDiff = statusPriority[statusA] - statusPriority[statusB]
    if (priorityDiff !== 0) return priorityDiff
    return getRowSortTime(b) - getRowSortTime(a)
  })
}

function mergeRows(
  pendingItems: Array<OcrPendingDossierT>,
  trackedItems: Array<OcrTrackedDossierT>,
  filter: OcrControlFilterT,
): Array<OcrControlRowT> {
  const pendingRows: Array<OcrControlRowT> = pendingItems.map((dossier) => ({
    kind: 'pending',
    dossier,
  }))
  const trackedRows: Array<OcrControlRowT> = trackedItems.map((dossier) => ({
    kind: 'tracked',
    dossier,
  }))

  if (filter === 'pending') return pendingRows
  if (filter === 'processing' || filter === 'completed' || filter === 'failed') {
    return trackedRows.filter(
      (row) => row.kind === 'tracked' && row.dossier.uiStatus === filter,
    )
  }

  const trackedIds = new Set(
    trackedItems.map((dossier) => dossier.dossierId),
  )
  const pendingOnly = pendingRows.filter(
    (row) => row.kind === 'pending' && !trackedIds.has(row.dossier.dossierId),
  )

  return sortMergedRows([...pendingOnly, ...trackedRows])
}

export function OcrControlPage() {
  const { t } = useTranslation('ocr-control')
  const language = useCurrentLanguage()
  const queryClient = useQueryClient()
  const { canTriggerOcr } = useOcrControlAccess()
  const { canRead: canReadExtractSettings } = useMetadataExtractSettingsAccess()
  const { permissions, primaryAppRole } = useDataManagementHubAccess()
  const projectCode = useAdminProjectCode() ?? undefined
  const dataRole = useMemo(
    () => resolveDataManagementRole(permissions, primaryAppRole),
    [permissions, primaryAppRole],
  )
  const canUpload = getPermissionsByRole(dataRole).canUpload

  const [filter, setFilter] = useState<OcrControlFilterT>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_LIMIT)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [uploadOpen, setUploadOpen] = useState(false)

  useOcrControlSocket(true)

  const isStatusFilter =
    filter === 'processing' || filter === 'completed' || filter === 'failed'

  const summaryQuery = useQuery(
    trackedManualDossiersQueryOptions({ page: 1, pageSize: 1 }),
  )

  const pendingSummaryQuery = useQuery(
    pendingManualDossiersQueryOptions({ page: 1, pageSize: 1 }),
  )

  const pendingQuery = useQuery({
    ...pendingManualDossiersQueryOptions({
      page: filter === 'pending' ? page : 1,
      pageSize: filter === 'pending' ? pageSize : 100,
    }),
    enabled: filter === 'all' || filter === 'pending',
  })

  const trackedQuery = useQuery({
    ...trackedManualDossiersQueryOptions({
      page: isStatusFilter ? page : 1,
      pageSize: isStatusFilter ? pageSize : 100,
      uiStatus: isStatusFilter ? filter : undefined,
    }),
    enabled: filter === 'all' || isStatusFilter,
  })

  const triggerMutation = useTriggerManualOcrMutation()

  const pendingItems = pendingQuery.data?.items ?? []
  const trackedItems = trackedQuery.data?.items ?? []
  const trackedSummary = summaryQuery.data?.summary ?? trackedQuery.data?.summary

  const allRows = useMemo(
    () => mergeRows(pendingItems, trackedItems, filter),
    [pendingItems, trackedItems, filter],
  )

  const totalRows =
    filter === 'all'
      ? allRows.length
      : filter === 'pending'
        ? (pendingQuery.data?.totalDossiers ?? 0)
        : (trackedQuery.data?.totalDossiers ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const pageRows =
    filter === 'all'
      ? allRows.slice((page - 1) * pageSize, page * pageSize)
      : allRows

  const isLoading =
    (filter === 'all' || filter === 'pending'
      ? pendingQuery.isPending
      : false) ||
    (filter === 'all' || isStatusFilter ? trackedQuery.isPending : false) ||
    summaryQuery.isPending
  const isFetching =
    pendingQuery.isFetching || trackedQuery.isFetching || summaryQuery.isFetching

  const pendingCount = pendingSummaryQuery.data?.totalDossiers ?? 0
  const selectablePendingIds = useMemo(
    () =>
      new Set(
        pendingItems
          .filter(
            (d) =>
              !trackedItems.some((tracked) => tracked.dossierId === d.dossierId),
          )
          .map((d) => d.dossierId),
      ),
    [pendingItems, trackedItems],
  )

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
        setPage(1)
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

  const selectedCount = Array.from(selectedIds).filter((id) =>
    selectablePendingIds.has(id),
  ).length

  return (
    <DigitizationSubPageShell active="ocr">
      <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard
            label={t('summary.pending')}
            value={pendingCount}
            tone="slate"
          />
          <SummaryCard
            label={t('summary.processing')}
            value={trackedSummary?.processingCount ?? 0}
            tone="amber"
          />
          <SummaryCard
            label={t('summary.completed')}
            value={trackedSummary?.completedCount ?? 0}
            tone="emerald"
          />
          <SummaryCard
            label={t('summary.failed')}
            value={trackedSummary?.failedCount ?? 0}
            tone="red"
          />
          <SummaryCard
            label={t('summary.total')}
            value={
              pendingCount +
              (trackedSummary?.processingCount ?? 0) +
              (trackedSummary?.completedCount ?? 0) +
              (trackedSummary?.failedCount ?? 0)
            }
            tone="muted"
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'pending', 'processing', 'completed', 'failed'] as const).map(
              (nextFilter) => (
                <Button
                  key={nextFilter}
                  type="button"
                  size="sm"
                  variant={filter === nextFilter ? 'default' : 'outline'}
                  onClick={() => {
                    setFilter(nextFilter)
                    setPage(1)
                  }}
                >
                  {t(`filters.${nextFilter}`)}
                </Button>
              ),
            )}
            {isFetching ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canReadExtractSettings ? (
              <Button type="button" size="sm" variant="outline" asChild>
                <Link to="/app/data-config/metadata-extract-settings">
                  <Settings2 className="mr-1.5 size-4" />
                  {t('actions.extractSettings')}
                </Link>
              </Button>
            ) : null}
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
            {canUpload ? (
              <Button type="button" size="sm" onClick={() => setUploadOpen(true)}>
                <FolderUp className="mr-1.5 size-4" />
                {t('actions.upload')}
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden" variant="list">
          {isLoading && pageRows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {!isLoading && pageRows.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Clock className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{t('empty.noItems')}</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {t('empty.noItemsHint')}
              </p>
            </div>
          ) : null}

          {pageRows.length > 0 ? (
            <UnifiedOcrTable
              rows={pageRows}
              canTriggerOcr={canTriggerOcr}
              expandedIds={expandedIds}
              selectedIds={selectedIds}
              selectablePendingIds={selectablePendingIds}
              isTriggering={triggerMutation.isPending}
              triggeringIds={triggerMutation.variables ?? []}
              language={language}
              onToggleExpanded={toggleExpanded}
              onToggleSelected={toggleSelected}
              onTrigger={(id) => void handleTrigger([id])}
            />
          ) : null}
        </Card>

        {pageRows.length > 0 ? (
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
        ) : null}

        {canUpload ? (
          <FolderUploadDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            role={dataRole}
            projectCode={projectCode}
            onUploadSuccess={async () => {
              await queryClient.invalidateQueries({
                queryKey: pendingManualDossiersQueryKeyPrefix,
              })
            }}
          />
        ) : null}
      </div>
    </DigitizationSubPageShell>
  )
}

function OcrDossierFileList({
  files,
  variant,
  language,
}: {
  files: Array<{
    id: string
    fileName: string
    createdAt?: string
    ocrTriggeredAt?: string | null
  }>
  variant: 'pending' | 'tracked'
  language: string
}) {
  const { t } = useTranslation('ocr-control')

  if (files.length === 0) return null

  return (
    <div className="rounded-lg border border-border/70 bg-card/90 p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <FileText className="size-3.5 shrink-0" aria-hidden />
        <span>{t('fileList.title', { count: files.length })}</span>
      </div>
      <div className="max-h-52 overflow-y-auto rounded-md border border-border/50">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-[1] bg-muted/90 backdrop-blur-sm">
            <tr className="text-left text-muted-foreground">
              <th className="w-9 px-2.5 py-2 font-medium">#</th>
              <th className="px-2.5 py-2 font-medium">{t('fileList.fileName')}</th>
              <th className="w-44 px-2.5 py-2 text-right font-medium">
                {t('fileList.time')}
              </th>
            </tr>
          </thead>
          <tbody>
            {files.map((file, index) => (
              <tr
                key={file.id}
                className="border-t border-border/40 transition-colors hover:bg-muted/50"
              >
                <td className="px-2.5 py-2 tabular-nums text-muted-foreground">
                  {index + 1}
                </td>
                <td className="px-2.5 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText
                      className="size-3.5 shrink-0 text-muted-foreground/70"
                      aria-hidden
                    />
                    <span className="truncate" title={file.fileName}>
                      {file.fileName}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 text-right text-muted-foreground">
                  {variant === 'pending'
                    ? file.createdAt
                      ? formatDate(file.createdAt, 'PPp', language)
                      : '—'
                    : file.ocrTriggeredAt
                      ? formatDate(file.ocrTriggeredAt, 'PPp', language)
                      : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UnifiedOcrTable({
  rows,
  canTriggerOcr,
  expandedIds,
  selectedIds,
  selectablePendingIds,
  isTriggering,
  triggeringIds,
  language,
  onToggleExpanded,
  onToggleSelected,
  onTrigger,
}: {
  rows: Array<OcrControlRowT>
  canTriggerOcr: boolean
  expandedIds: Set<string>
  selectedIds: Set<string>
  selectablePendingIds: Set<string>
  isTriggering: boolean
  triggeringIds: Array<string>
  language: string
  onToggleExpanded: (id: string) => void
  onToggleSelected: (id: string, checked: boolean) => void
  onTrigger: (id: string) => void
}) {
  const { t } = useTranslation('ocr-control')

  return (
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
            <TableHead>{t('columns.status')}</TableHead>
            <TableHead className="hidden lg:table-cell">
              {t('columns.time')}
            </TableHead>
            <TableHead className="hidden lg:table-cell">
              {t('columns.elapsed')}
            </TableHead>
            <TableHead className="w-[140px] text-right">
              {t('columns.actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const dossierId =
              row.kind === 'pending'
                ? row.dossier.dossierId
                : row.dossier.dossierId
            const isExpanded = expandedIds.has(dossierId)
            const isPending = row.kind === 'pending'
            const canSelect = isPending && selectablePendingIds.has(dossierId)
            const isSelected = selectedIds.has(dossierId)
            const isTriggeringThis =
              isTriggering && triggeringIds.includes(dossierId)

            const dossierName =
              row.kind === 'pending'
                ? row.dossier.dossierName
                : row.dossier.dossierName
            const folderPath =
              row.kind === 'pending'
                ? row.dossier.folderPath
                : row.dossier.folderPath

            return (
              <>
                <TableRow key={dossierId}>
                  {canTriggerOcr ? (
                    <TableCell>
                      {canSelect ? (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            onToggleSelected(dossierId, checked === true)
                          }
                        />
                      ) : null}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => onToggleExpanded(dossierId)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium leading-tight">{dossierName}</p>
                    {row.kind === 'tracked' ? (
                      <p className="text-xs text-muted-foreground">
                        {t('columns.triggeredFiles', {
                          count: row.dossier.triggeredFileCount,
                        })}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t('columns.pendingFiles', {
                          count: row.dossier.pendingFileCount,
                        })}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-[280px] truncate font-mono text-xs text-muted-foreground md:table-cell">
                    {folderPath}
                  </TableCell>
                  <TableCell>
                    <OcrRowStatusBadge
                      status={
                        row.kind === 'pending' ? 'pending' : row.dossier.uiStatus
                      }
                    />
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                    {row.kind === 'pending'
                      ? formatDate(row.dossier.oldestPendingAt, 'PPp', language)
                      : formatDate(row.dossier.latestTriggeredAt, 'PPp', language)}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                    {row.kind === 'tracked' && row.dossier.uiStatus === 'processing'
                      ? formatElapsedSince(row.dossier.latestTriggeredAt)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {canTriggerOcr && isPending && canSelect ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isTriggering}
                        onClick={() => onTrigger(dossierId)}
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
                  <TableRow key={`${dossierId}-details`}>
                    <TableCell
                      colSpan={canTriggerOcr ? 8 : 7}
                      className="bg-muted/20 px-4 py-3"
                    >
                      <OcrDossierFileList
                        files={
                          row.kind === 'pending'
                            ? row.dossier.pendingFiles
                            : row.dossier.triggeredFiles
                        }
                        variant={row.kind === 'pending' ? 'pending' : 'tracked'}
                        language={language}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
