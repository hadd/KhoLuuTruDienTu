import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Download, Eye, FileSpreadsheet, Loader2, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  stickyTableHeaderClassName,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AuditLogDetailSheet } from '@/features/audit-log/components/AuditLogDetailSheet'
import { AuditLogFilters } from '@/features/audit-log/components/AuditLogFilters'
import {
  AuditLogStatusCell,
  AuditLogTimeCell,
  getAuditLogUserLabel,
} from '@/features/audit-log/components/auditLogColumns'
import { useAuditLogAccess } from '@/features/audit-log/hooks/useAuditLogAccess'
import {
  auditLogsQueryOptions,
  useDeleteAuditLog,
  useExportAuditLogs,
} from '@/features/audit-log/queries'
import { resolveAuditLogDisplay } from '@/features/audit-log/lib/deriveAuditDisplay'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'

const routeApi = getRouteApi('/app/audit-logs/')

type FilterDraft = {
  dateFrom: string
  dateTo: string
  module: string
  eventType: string
}

function countActiveFilters(draft: FilterDraft) {
  return [draft.dateFrom, draft.dateTo, draft.module, draft.eventType].filter(
    Boolean,
  ).length
}

export function AuditLogListPage() {
  const { t } = useTranslation('audit-log')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { canDelete, canExport } = useAuditLogAccess()
  const deleteMutation = useDeleteAuditLog()
  const exportMutation = useExportAuditLogs()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(search.q ?? '')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterDraft, setFilterDraft] = useState<FilterDraft>({
    dateFrom: search.dateFrom ?? '',
    dateTo: search.dateTo ?? '',
    module: search.module ?? '',
    eventType: search.eventType ?? '',
  })

  const appliedFilters: FilterDraft = {
    dateFrom: search.dateFrom ?? '',
    dateTo: search.dateTo ?? '',
    module: search.module ?? '',
    eventType: search.eventType ?? '',
  }
  const activeFilterCount = countActiveFilters(appliedFilters)

  const queryParams = useMemo(
    () => ({
      page: search.page ?? 1,
      limit: search.limit ?? DEFAULT_LIST_PAGE_LIMIT,
      search: search.q,
      dateFrom: search.dateFrom,
      dateTo: search.dateTo,
      module: search.module,
      eventType: search.eventType,
    }),
    [search],
  )

  const { data, isLoading } = useQuery(auditLogsQueryOptions(queryParams))

  const updateSearch = (patch: Record<string, string | number | undefined>) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        page: patch.page ?? 1,
      }),
    })
  }

  const handleExport = async (format: 'json' | 'xlsx') => {
    const blob = await exportMutation.mutateAsync({ ...queryParams, format })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `audit-logs-${Date.now()}.${format === 'xlsx' ? 'xlsx' : 'json'}`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const openFilters = () => {
    setFilterDraft(appliedFilters)
    setFilterOpen(true)
  }

  const applyFilters = () => {
    updateSearch({
      dateFrom: filterDraft.dateFrom || undefined,
      dateTo: filterDraft.dateTo || undefined,
      module: filterDraft.module || undefined,
      eventType: filterDraft.eventType || undefined,
    })
    setFilterOpen(false)
  }

  const clearFilters = () => {
    setFilterDraft({ dateFrom: '', dateTo: '', module: '', eventType: '' })
    updateSearch({
      dateFrom: undefined,
      dateTo: undefined,
      module: undefined,
      eventType: undefined,
    })
    setFilterOpen(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <ListPageSearchInput
            className="w-full sm:max-w-md"
            value={searchInput}
            onChange={setSearchInput}
            onSearch={() => updateSearch({ q: searchInput || undefined })}
            placeholder={t('search.placeholder')}
          />
          <Button
            type="button"
            variant={filterOpen || activeFilterCount > 0 ? 'default' : 'outline'}
            className="shrink-0 gap-1.5"
            onClick={openFilters}
          >
            <SlidersHorizontal className="size-4 shrink-0" />
            <span className="hidden sm:inline">{t('filters.open')}</span>
            {activeFilterCount > 0 ? (
              <Badge
                variant={filterOpen ? 'secondary' : 'default'}
                className="h-5 min-w-5 px-1.5"
              >
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
        </div>
        {canExport ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleExport('json')}
              disabled={exportMutation.isPending}
            >
              <Download className="mr-2 size-4" />
              {t('actions.exportJson')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleExport('xlsx')}
              disabled={exportMutation.isPending}
            >
              <FileSpreadsheet className="mr-2 size-4" />
              {t('actions.exportExcel')}
            </Button>
          </div>
        ) : null}
      </div>

      <Card
        variant="list"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          <Table
            className="w-full min-w-[720px] table-fixed border-separate border-spacing-0"
            containerClassName="h-full min-h-0 overflow-auto"
          >
            <TableHeader className={stickyTableHeaderClassName}>
              <TableRow className="hover:bg-muted">
                <TableHead className="w-[11rem]">{t('table.columns.createdAt')}</TableHead>
                <TableHead className="w-[22%]">{t('table.columns.user')}</TableHead>
                <TableHead className="w-[18%]">{t('table.columns.module')}</TableHead>
                <TableHead className="w-[16%]">{t('table.columns.eventType')}</TableHead>
                <TableHead className="w-[8rem]">{t('table.columns.status')}</TableHead>
                <TableHead className="w-24 text-right">
                  {t('table.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center">
                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : data?.items.length ? (
                data.items.map((log) => {
                  const display = resolveAuditLogDisplay(log, t, t('unknown'))
                  const moduleLabel = display.module
                    ? t(`modules.${display.module}`, {
                        defaultValue: display.module,
                      })
                    : t('unknown')
                  const eventLabel = display.eventType
                    ? t(`events.${display.eventType}`, {
                        defaultValue: display.eventType,
                      })
                    : t('unknown')
                  const userLabel = getAuditLogUserLabel(log, t('unknown'))
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="overflow-hidden">
                        <span className="block truncate">
                          <AuditLogTimeCell value={log.createdAt} compact />
                        </span>
                      </TableCell>
                      <TableCell className="overflow-hidden" title={userLabel}>
                        <span className="block truncate">{userLabel}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden" title={moduleLabel}>
                        <span className="block truncate">{moduleLabel}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden" title={eventLabel}>
                        <span className="block truncate">{eventLabel}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <AuditLogStatusCell statusCode={log.statusCode} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedId(log.id)}
                            aria-label={t('actions.view')}
                          >
                            <Eye className="size-4" />
                          </Button>
                          {canDelete && log.source !== 'archived' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTargetId(log.id)}
                              disabled={deleteMutation.isPending}
                              aria-label={t('actions.delete')}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t('empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="shrink-0">
        <ListPagePagination
          page={search.page ?? 1}
          limit={search.limit ?? DEFAULT_LIST_PAGE_LIMIT}
          totalPages={data?.totalPages ?? 1}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageChange={(page) => updateSearch({ page })}
          onLimitChange={(limit) => updateSearch({ limit, page: 1 })}
        />
      </div>

      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
          ariaTitle={t('filters.title')}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
            <SheetTitle>{t('filters.title')}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <AuditLogFilters
              dateFrom={filterDraft.dateFrom}
              dateTo={filterDraft.dateTo}
              module={filterDraft.module}
              eventType={filterDraft.eventType}
              onDateFromChange={(value) =>
                setFilterDraft((prev) => ({ ...prev, dateFrom: value }))
              }
              onDateToChange={(value) =>
                setFilterDraft((prev) => ({ ...prev, dateTo: value }))
              }
              onModuleChange={(value) =>
                setFilterDraft((prev) => ({
                  ...prev,
                  module: value,
                  eventType: '',
                }))
              }
              onEventTypeChange={(value) =>
                setFilterDraft((prev) => ({ ...prev, eventType: value }))
              }
            />
          </div>
          <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t bg-background px-6 py-4">
            <Button type="button" variant="ghost" onClick={clearFilters}>
              {t('filters.clear')}
            </Button>
            <Button type="button" onClick={applyFilters}>
              {t('filters.apply')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AuditLogDetailSheet
        logId={selectedId}
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      />

      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t('delete.cancelButton')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                if (!deleteTargetId) return
                deleteMutation.mutate(deleteTargetId, {
                  onSuccess: () => setDeleteTargetId(null),
                })
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending
                ? t('delete.deleting')
                : t('delete.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
