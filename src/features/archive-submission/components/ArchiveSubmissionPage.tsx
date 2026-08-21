import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Eye, Loader2, Package } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArchiveSubmitDialog } from '@/features/archive-submission/components/ArchiveSubmitDialog'
import { ArchiveSubmissionDetailDialog } from '@/features/archive-submission/components/ArchiveSubmissionDetailDialog'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import { canSubmitDossierToArchive } from '@/features/archive-submission/lib/archiveSubmissionAccess'
import { archiveDossiersQueryOptions } from '@/features/archive-submission/queries'
import type {
  ArchiveDossierListItemT,
  ArchiveDossierStatusT,
} from '@/features/archive-submission/types'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'

const routeApi = getRouteApi('/app/archive-warehouse/')

function statusBadgeVariant(
  status: ArchiveDossierStatusT,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'APPROVED':
      return 'secondary'
    case 'PENDING_ARCHIVE':
      return 'default'
    case 'ARCHIVED':
      return 'outline'
    case 'ARCHIVE_REJECTED':
      return 'destructive'
    default:
      return 'secondary'
  }
}

interface ArchiveSubmissionPageProps {
  embedded?: boolean
}

export function ArchiveSubmissionPage({
  embedded = false,
}: ArchiveSubmissionPageProps) {
  const { t } = useTranslation('archive-submission')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { canSubmitArchive } = useArchiveSubmissionAccess()

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const statusParam = (search.status as ArchiveDossierStatusT | 'ALL' | undefined) ?? 'ALL'

  const [inputValue, setInputValue] = useState(q)
  const [submitTarget, setSubmitTarget] = useState<ArchiveDossierListItemT | null>(
    null,
  )
  const [detailTarget, setDetailTarget] = useState<ArchiveDossierListItemT | null>(
    null,
  )

  const { data, isPending, isFetching, refetch } = useQuery(
    archiveDossiersQueryOptions({
      page,
      limit,
      search: q || undefined,
      status: statusParam === 'ALL' ? undefined : (statusParam as ArchiveDossierStatusT),
    }),
  )

  const items = (data?.items ?? []).filter((item) => item.status !== 'ARCHIVED')
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)

  useEffect(() => {
    setInputValue(q)
  }, [q])

  useEffect(() => {
    if (isPending || isFetching || !data) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [safePage, page, navigate, isPending, isFetching, data])

  function submitSearch() {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: inputValue.trim() ? inputValue.trim() : undefined,
        page: 1,
      }),
      replace: true,
    })
  }

  function handleStatusFilterChange(nextStatus: string) {
    void navigate({
      search: (prev) => ({
        ...prev,
        status: nextStatus === 'ALL' ? undefined : (nextStatus as ArchiveDossierStatusT),
        page: 1,
      }),
      replace: true,
    })
  }

  if (!canSubmitArchive) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('errors.noPermission')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('page.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('page.description')}</p>
        </div>
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="min-w-[240px] flex-1">
          <ListPageSearchInput
            value={inputValue}
            onChange={setInputValue}
            onSearch={submitSearch}
            placeholder={t('page.searchPlaceholder')}
          />
        </div>
        <div className="w-[200px] shrink-0">
          <Select
            value={statusParam}
            onValueChange={handleStatusFilterChange}
          >
            <SelectTrigger size="default">
              <SelectValue placeholder={t('page.statusFilterLabel')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('statusFilter.ALL')}</SelectItem>
              <SelectItem value="APPROVED">{t('statusFilter.APPROVED')}</SelectItem>
              <SelectItem value="PENDING_ARCHIVE">{t('statusFilter.PENDING_ARCHIVE')}</SelectItem>
              <SelectItem value="ARCHIVE_REJECTED">{t('statusFilter.ARCHIVE_REJECTED')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isPending && items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!isPending && items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t('page.empty')}
        </Card>
      ) : null}

      {items.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.name')}</TableHead>
                <TableHead>{t('table.path')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead>{t('table.lastSubmission')}</TableHead>
                <TableHead className="text-right">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {item.folderPath}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <Badge variant={statusBadgeVariant(item.status)}>
                      {t(`dossierStatus.${item.status}`)}
                    </Badge>
                    {item.status === 'ARCHIVE_REJECTED' && item.latestSubmission?.rejectNotes ? (
                      <div className="mt-1.5 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                        <span className="font-semibold">Lý do từ chối:</span>{' '}
                        {item.latestSubmission.rejectNotes}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.latestSubmission
                      ? new Date(item.latestSubmission.submittedAt).toLocaleString()
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {item.latestSubmission ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setDetailTarget(item)}
                        >
                          <Eye className="mr-1 size-4" />
                          {t('actions.view')}
                        </Button>
                      ) : null}
                      {canSubmitDossierToArchive(item.status) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={item.status === 'ARCHIVE_REJECTED' ? 'destructive' : 'default'}
                          onClick={() => setSubmitTarget(item)}
                        >
                          <Package className="mr-1 size-4" />
                          {item.status === 'ARCHIVE_REJECTED' ? 'Nộp lại' : t('submit.action')}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ListPagePagination
          page={safePage}
          totalPages={totalPages}
          limit={limit}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageChange={(nextPage) => {
            void navigate({
              search: (prev) => ({ ...prev, page: nextPage }),
              replace: true,
            })
          }}
          onLimitChange={(nextLimit) => {
            void navigate({
              search: (prev) => ({ ...prev, limit: nextLimit, page: 1 }),
              replace: true,
            })
          }}
        />
      ) : null}

      <ArchiveSubmitDialog
        open={Boolean(submitTarget)}
        onOpenChange={(open) => {
          if (!open) setSubmitTarget(null)
        }}
        dossierId={submitTarget?.id ?? null}
        dossierName={submitTarget?.name}
        onSuccess={() => {
          void refetch()
          setSubmitTarget(null)
        }}
      />

      <ArchiveSubmissionDetailDialog
        open={Boolean(detailTarget)}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null)
        }}
        dossier={detailTarget}
      />
    </div>
  )
}
