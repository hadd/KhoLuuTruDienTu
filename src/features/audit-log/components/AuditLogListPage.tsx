import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Download, Eye, Loader2, Trash2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
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
  usePurgeAuditLogs,
} from '@/features/audit-log/queries'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'

const routeApi = getRouteApi('/app/audit-logs/')

export function AuditLogListPage() {
  const { t } = useTranslation('audit-log')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { canDelete, canExport } = useAuditLogAccess()
  const deleteMutation = useDeleteAuditLog()
  const exportMutation = useExportAuditLogs()
  const purgeMutation = usePurgeAuditLogs()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false)
  const [searchInput, setSearchInput] = useState(search.q ?? '')

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {canExport ? (
            <>
              <Button
                variant="outline"
                onClick={() => handleExport('json')}
                disabled={exportMutation.isPending}
              >
                <Download className="mr-2 size-4" />
                {t('actions.exportJson')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport('xlsx')}
                disabled={exportMutation.isPending}
              >
                <Download className="mr-2 size-4" />
                {t('actions.exportExcel')}
              </Button>
            </>
          ) : null}
          {canDelete ? (
            <Button
              variant="destructive"
              onClick={() => setPurgeConfirmOpen(true)}
              disabled={purgeMutation.isPending}
            >
              {t('actions.purgeExpired')}
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <ListPageSearchInput
            value={searchInput}
            onChange={setSearchInput}
            onSearch={() => updateSearch({ q: searchInput || undefined })}
            placeholder={t('search.placeholder')}
          />
          <AuditLogFilters
            dateFrom={search.dateFrom ?? ''}
            dateTo={search.dateTo ?? ''}
            module={search.module ?? ''}
            eventType={search.eventType ?? ''}
            onDateFromChange={(value) => updateSearch({ dateFrom: value || undefined })}
            onDateToChange={(value) => updateSearch({ dateTo: value || undefined })}
            onModuleChange={(value) => updateSearch({ module: value || undefined })}
            onEventTypeChange={(value) =>
              updateSearch({ eventType: value || undefined })
            }
          />
        </div>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.columns.createdAt')}</TableHead>
                <TableHead>{t('table.columns.user')}</TableHead>
                <TableHead>{t('table.columns.module')}</TableHead>
                <TableHead>{t('table.columns.eventType')}</TableHead>
                <TableHead>{t('table.columns.summary')}</TableHead>
                <TableHead>{t('table.columns.status')}</TableHead>
                <TableHead className="text-right">{t('table.columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center">
                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : data?.items.length ? (
                data.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell><AuditLogTimeCell value={log.createdAt} /></TableCell>
                    <TableCell>{getAuditLogUserLabel(log, t('unknown'))}</TableCell>
                    <TableCell>
                      {log.module
                        ? t(`modules.${log.module}`, { defaultValue: log.module })
                        : t('unknown')}
                    </TableCell>
                    <TableCell>
                      {log.eventType
                        ? t(`events.${log.eventType}`, { defaultValue: log.eventType })
                        : t('unknown')}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.summary ?? t('unknown')}
                    </TableCell>
                    <TableCell><AuditLogStatusCell statusCode={log.statusCode} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedId(log.id)}
                          aria-label={t('actions.view')}
                        >
                          <Eye className="size-4" />
                        </Button>
                        {canDelete ? (
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="border-t p-4">
          <ListPagePagination
            page={search.page ?? 1}
            limit={search.limit ?? DEFAULT_LIST_PAGE_LIMIT}
            totalPages={data?.totalPages ?? 1}
            pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
            onPageChange={(page) => updateSearch({ page })}
            onLimitChange={(limit) => updateSearch({ limit, page: 1 })}
          />
        </div>
      </Card>

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
            <AlertDialogDescription>{t('delete.confirmDescription')}</AlertDialogDescription>
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
              {deleteMutation.isPending ? t('delete.deleting') : t('delete.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={purgeConfirmOpen} onOpenChange={setPurgeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('purge.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('purge.confirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purgeMutation.isPending}>
              {t('purge.cancelButton')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                purgeMutation.mutate(false, {
                  onSuccess: () => setPurgeConfirmOpen(false),
                })
              }}
              disabled={purgeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {purgeMutation.isPending ? t('purge.confirming') : t('purge.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
