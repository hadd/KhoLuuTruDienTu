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

const routeApi = getRouteApi('/app/archive-submission/')

const STATUS_FILTERS: Array<ArchiveDossierStatusT | 'ALL'> = [
  'ALL',
  'APPROVED',
  'PENDING_ARCHIVE',
  'ARCHIVED',
  'ARCHIVE_REJECTED',
]

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

export function ArchiveSubmissionPage() {
  const { t } = useTranslation('archive-submission')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { canSubmitArchive } = useArchiveSubmissionAccess()

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const statusFilter = search.status

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
      status: statusFilter,
    }),
  )

  const items = data?.items ?? []
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

  function handleStatusFilter(next: ArchiveDossierStatusT | 'ALL') {
    void navigate({
      search: (prev) => ({
        ...prev,
        status: next === 'ALL' ? undefined : next,
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
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('page.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('page.description')}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ListPageSearchInput
          value={inputValue}
          onChange={setInputValue}
          onSearch={submitSearch}
          placeholder={t('page.searchPlaceholder')}
        />
        <Select
          value={statusFilter ?? 'ALL'}
          onValueChange={(value) =>
            handleStatusFilter(value as ArchiveDossierStatusT | 'ALL')
          }
        >
          <SelectTrigger
            className="w-full sm:w-[220px]"
            aria-label={t('page.statusFilterLabel')}
          >
            <SelectValue placeholder={t('page.statusFilterLabel')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`statusFilter.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                  <TableCell>
                    <Badge variant={statusBadgeVariant(item.status)}>
                      {t(`dossierStatus.${item.status}`)}
                    </Badge>
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
                          onClick={() => setSubmitTarget(item)}
                        >
                          <Package className="mr-1 size-4" />
                          {t('submit.action')}
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
