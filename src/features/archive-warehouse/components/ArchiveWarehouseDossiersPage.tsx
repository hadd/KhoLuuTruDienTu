import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Search } from 'lucide-react'
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
import { WAREHOUSE_DOSSIER_STATUSES } from '@/features/archive-warehouse/api/archiveWarehouseClient'
import { ArchiveWarehouseStatCards } from '@/features/archive-warehouse/components/ArchiveWarehouseStatCards'
import {
  archiveWarehouseDossiersQueryOptions,
  archiveWarehouseFondSummaryQueryOptions,
  archiveWarehouseFondsQueryOptions,
  archiveWarehouseSearchQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { WarehouseDossierStatusT } from '@/features/archive-warehouse/types'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-dossiers/$fondId/')

const ALL_YEARS = 'ALL'
const DEFAULT_STATUS: WarehouseDossierStatusT = 'ARCHIVED'

export function ArchiveWarehouseDossiersPage() {
  const { t, i18n } = useTranslation('archive-warehouse')
  const { fondId } = routeApi.useParams()
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const year = search.year
  const status = search.status ?? DEFAULT_STATUS
  const contentSearch = search.contentSearch ?? true

  const [inputValue, setInputValue] = useState(q)

  const { data: fondsData } = useQuery(archiveWarehouseFondsQueryOptions())
  const fondName =
    fondsData?.items.find((fond) => fond.id === fondId)?.fondName ?? fondId

  const listParams = {
    fondId,
    page,
    limit,
    search: q && !contentSearch ? q : undefined,
    year,
    status,
  }

  const summaryParams = { fondId, status }
  const searchParams =
    q && contentSearch
      ? {
          q,
          fondId,
          limit,
          offset: (page - 1) * limit,
        }
      : null

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

  const {
    data: searchData,
    isPending: isSearchPending,
    isFetching: isSearchFetching,
    isError: isSearchError,
    error: searchError,
  } = useQuery(archiveWarehouseSearchQueryOptions(searchParams))

  const isContentSearchActive = Boolean(q && contentSearch)
  const items = isContentSearchActive ? [] : (data?.items ?? [])
  const searchItems = isContentSearchActive ? (searchData?.items ?? []) : []
  const totalPages = Math.max(
    1,
    isContentSearchActive
      ? Math.ceil((searchData?.total ?? 0) / limit) || 1
      : (data?.totalPages ?? 1),
  )
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const hasActiveFilters = Boolean(q) || year != null
  const listLoading = isContentSearchActive
    ? isSearchPending || isSearchFetching
    : isPending || isFetching

  useEffect(() => {
    setInputValue(q)
  }, [q])

  useEffect(() => {
    if (listLoading) return
    if (isContentSearchActive ? !searchData : !data) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [safePage, page, navigate, listLoading, data, searchData, isContentSearchActive])

  function submitSearch() {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: inputValue.trim() ? inputValue.trim() : undefined,
        page: 1,
        contentSearch: true,
      }),
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

  function openDossierDetail(
    dossierId: string,
    match?: {
      fileName?: string | null
      page?: number | null
      bbox?: number[] | null
    },
  ) {
    const highlightBbox =
      match?.bbox && match.bbox.length >= 4
        ? match.bbox.slice(0, 4).join(',')
        : undefined

    void navigate({
      to: '/app/archive-dossiers/$fondId/$dossierId',
      params: { fondId, dossierId },
      search: {
        fileName: match?.fileName ?? undefined,
        highlightPage: match?.page && match.page > 0 ? match.page : undefined,
        highlightBbox,
      },
    })
  }

  const forbiddenMessage =
    isSummaryError || isListError || isSearchError
      ? translateError(
          (summaryError ?? listError ?? searchError) instanceof Error
            ? (summaryError ?? listError ?? searchError)
            : new Error(t('errors.fondForbidden')),
        )
      : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-col items-start gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/archive-dossiers">
            <ArrowLeft className="mr-2 size-4" aria-hidden />
            {t('page.backToFonds')}
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">{fondName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('page.fondDossiersDescription')}
          </p>
        </div>
      </div>

      {forbiddenMessage ? (
        <Card className="border-destructive p-8 text-center text-sm text-destructive">
          {forbiddenMessage}
        </Card>
      ) : null}

      {!forbiddenMessage && summaryData ? (
        <ArchiveWarehouseStatCards summary={summaryData} />
      ) : null}

      {!forbiddenMessage ? (
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
                disabled={isContentSearchActive}
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

          {isContentSearchActive ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Search className="size-3.5" aria-hidden />
              {t('page.contentSearchHint')}
              {searchData?.took_ms != null
                ? ` · ${t('page.searchTook', { ms: searchData.took_ms })}`
                : null}
            </p>
          ) : null}

          {listLoading && items.length === 0 && searchItems.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {!listLoading &&
          !isContentSearchActive &&
          summaryData?.dossierCount === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {t('page.fondEmpty')}
            </Card>
          ) : null}

          {!listLoading &&
          !isContentSearchActive &&
          summaryData &&
          summaryData.dossierCount > 0 &&
          items.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {hasActiveFilters ? t('page.noMatch') : t('page.fondEmpty')}
            </Card>
          ) : null}

          {!listLoading && isContentSearchActive && searchItems.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {searchData?.message ?? t('page.noMatch')}
            </Card>
          ) : null}

          {isContentSearchActive && searchItems.length > 0 ? (
            <div className="min-h-0 flex-1 space-y-2 overflow-auto">
              {searchItems.map((hit) => (
                <button
                  key={`${hit.entityType}-${hit.entityId}`}
                  type="button"
                  className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/40"
                  onClick={() =>
                    openDossierDetail(hit.entityId, hit.matches?.[0])
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{hit.title}</p>
                    <Badge variant="outline">{t('status.ARCHIVED')}</Badge>
                  </div>
                  {hit.snippet ? (
                    <p
                      className="mt-2 text-sm text-muted-foreground [&_em]:font-semibold [&_em]:not-italic [&_em]:text-foreground [&_mark]:rounded-sm [&_mark]:bg-primary/20 [&_mark]:font-semibold [&_mark]:text-foreground"
                      dangerouslySetInnerHTML={{ __html: hit.snippet }}
                    />
                  ) : null}
                  {hit.matches?.[0]?.fileName ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hit.matches[0].fileName}
                      {hit.matches[0].page != null
                        ? ` · trang ${hit.matches[0].page}`
                        : ''}
                    </p>
                  ) : null}
                  {typeof hit.metadata.folderPath === 'string' ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {hit.metadata.folderPath}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {!isContentSearchActive && items.length > 0 ? (
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

          {items.length > 0 || searchItems.length > 0 ? (
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
    </div>
  )
}
