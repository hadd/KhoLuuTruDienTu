import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Badge } from '@/components/ui/badge'
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
import { activeArchiveFondsQueryOptions } from '@/features/archive-permission/queries'
import { WAREHOUSE_DOSSIER_STATUSES } from '@/features/archive-warehouse/api/archiveWarehouseClient'
import { ArchiveWarehouseDossierDetailDrawer } from '@/features/archive-warehouse/components/ArchiveWarehouseDossierDetailDrawer'
import { ArchiveWarehouseStatCards } from '@/features/archive-warehouse/components/ArchiveWarehouseStatCards'
import {
  archiveWarehouseDossiersQueryOptions,
  archiveWarehouseFondSummaryQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { WarehouseDossierStatusT } from '@/features/archive-warehouse/types'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-dossiers/')

const ALL_YEARS = 'ALL'
const DEFAULT_STATUS: WarehouseDossierStatusT = 'ARCHIVED'

export function ArchiveWarehouseDossiersPage() {
  const { t, i18n } = useTranslation('archive-warehouse')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const fondId = search.fondId
  const year = search.year
  const status = search.status ?? DEFAULT_STATUS
  const dossierId = search.dossierId ?? null

  const [inputValue, setInputValue] = useState(q)

  const { data: fondsData } = useQuery(activeArchiveFondsQueryOptions())
  const activeFonds = fondsData?.items ?? []

  const listParams = fondId
    ? {
        fondId,
        page,
        limit,
        search: q || undefined,
        year,
        status,
      }
    : null

  const summaryParams = fondId ? { fondId, status } : null

  const {
    data: summaryData,
    isError: isSummaryError,
    error: summaryError,
  } = useQuery(archiveWarehouseFondSummaryQueryOptions(summaryParams))

  const {
    data,
    isPending,
    isFetching,
    isError: isListError,
    error: listError,
  } = useQuery(archiveWarehouseDossiersQueryOptions(listParams))

  const fondScope = summaryData?.fondScope ?? data?.fondScope ?? null

  const fondOptions = useMemo(() => {
    if (fondScope == null) {
      return activeFonds
    }
    return activeFonds.filter((fond) => fondScope.includes(fond.id))
  }, [activeFonds, fondScope])

  const items = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const hasActiveFilters = Boolean(q) || year != null

  useEffect(() => {
    setInputValue(q)
  }, [q])

  useEffect(() => {
    if (fondId || fondOptions.length !== 1) {
      return
    }
    void navigate({
      search: (prev) => ({ ...prev, fondId: fondOptions[0]?.id }),
      replace: true,
    })
  }, [fondId, fondOptions, navigate])

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

  function handleFondChange(nextFondId: string) {
    void navigate({
      search: {
        fondId: nextFondId,
        page: 1,
        limit,
        status,
      },
      replace: true,
    })
  }

  function handleYearFilter(next: string) {
    void navigate({
      search: (prev) => ({
        ...prev,
        year: next === ALL_YEARS ? undefined : Number(next),
        page: 1,
      }),
      replace: true,
    })
  }

  function handleStatusFilter(next: WarehouseDossierStatusT) {
    void navigate({
      search: (prev) => ({
        ...prev,
        status: next,
        page: 1,
      }),
      replace: true,
    })
  }

  function openDossierDetail(id: string) {
    void navigate({
      search: (prev) => ({ ...prev, dossierId: id }),
      replace: true,
    })
  }

  function closeDossierDetail() {
    void navigate({
      search: (prev) => ({ ...prev, dossierId: undefined }),
      replace: true,
    })
  }

  const forbiddenMessage =
    isSummaryError || isListError
      ? translateError(
          (summaryError ?? listError) instanceof Error
            ? (summaryError ?? listError)
            : new Error(t('errors.fondForbidden')),
        )
      : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('page.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('page.description')}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={fondId ?? ''} onValueChange={handleFondChange}>
          <SelectTrigger
            className="w-full sm:w-[320px]"
            aria-label={t('page.fondFilterLabel')}
          >
            <SelectValue placeholder={t('page.fondFilterLabel')} />
          </SelectTrigger>
          <SelectContent>
            {fondOptions.map((fond) => (
              <SelectItem key={fond.id} value={fond.id}>
                {fond.fondName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!fondId ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t('page.selectFondFirst')}
        </Card>
      ) : null}

      {fondId && forbiddenMessage ? (
        <Card className="border-destructive p-8 text-center text-sm text-destructive">
          {forbiddenMessage}
        </Card>
      ) : null}

      {fondId && !forbiddenMessage && summaryData ? (
        <ArchiveWarehouseStatCards summary={summaryData} />
      ) : null}

      {fondId && !forbiddenMessage ? (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <ListPageSearchInput
              value={inputValue}
              onChange={setInputValue}
              onSearch={submitSearch}
              placeholder={t('page.searchPlaceholder')}
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select
                value={year != null ? String(year) : ALL_YEARS}
                onValueChange={handleYearFilter}
              >
                <SelectTrigger
                  className="w-full sm:w-[180px]"
                  aria-label={t('filters.year')}
                >
                  <SelectValue placeholder={t('filters.year')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_YEARS}>{t('filters.allYears')}</SelectItem>
                  {(summaryData?.availableYears ?? []).map((itemYear) => (
                    <SelectItem key={itemYear} value={String(itemYear)}>
                      {itemYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={handleStatusFilter}>
                <SelectTrigger
                  className="w-full sm:w-[200px]"
                  aria-label={t('filters.status')}
                >
                  <SelectValue placeholder={t('filters.status')} />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_DOSSIER_STATUSES.map((itemStatus) => (
                    <SelectItem key={itemStatus} value={itemStatus}>
                      {t(`status.${itemStatus}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isPending && items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {!isPending && summaryData?.dossierCount === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {t('page.fondEmpty')}
            </Card>
          ) : null}

          {!isPending &&
          summaryData &&
          summaryData.dossierCount > 0 &&
          items.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {hasActiveFilters ? t('page.noMatch') : t('page.fondEmpty')}
            </Card>
          ) : null}

          {items.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.name')}</TableHead>
                    <TableHead>{t('table.documentCount')}</TableHead>
                    <TableHead>{t('table.archivedAt')}</TableHead>
                    <TableHead>{t('table.path')}</TableHead>
                    <TableHead>{t('table.projectCode')}</TableHead>
                    <TableHead>{t('table.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => openDossierDetail(item.id)}
                    >
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.documentCount}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {item.archivedAt
                          ? formatDate(item.archivedAt, 'PPp', i18n.language)
                          : '—'}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">
                        {item.folderPath ?? '—'}
                      </TableCell>
                      <TableCell>{item.projectCode ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{t(`status.${item.status}`)}</Badge>
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
        </>
      ) : null}

      <ArchiveWarehouseDossierDetailDrawer
        dossierId={dossierId}
        open={Boolean(dossierId)}
        onOpenChange={(open) => {
          if (!open) {
            closeDossierDetail()
          }
        }}
      />
    </div>
  )
}
