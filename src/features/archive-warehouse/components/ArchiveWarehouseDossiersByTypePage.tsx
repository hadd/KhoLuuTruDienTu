import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { ArchiveWarehouseDataShell } from '@/features/archive-warehouse/components/ArchiveWarehouseDataShell'
import { ArchiveWarehouseStatCards } from '@/features/archive-warehouse/components/ArchiveWarehouseStatCards'
import { UNASSIGNED_WAREHOUSE_FOND_ID } from '@/features/archive-warehouse/lib/unassignedFond'
import {
  archiveWarehouseDossierTypeSummaryQueryOptions,
  archiveWarehouseDossierTypesQueryOptions,
  archiveWarehouseDossiersByTypeQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { ArchiveWarehouseDossiersByTypeSearchT } from '@/features/archive-warehouse/schemas'
import type { WarehouseDossierStatusT } from '@/features/archive-warehouse/types'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-dossiers/by-dossier-type/$dossierTypeId/')

const DEFAULT_STATUS: WarehouseDossierStatusT = 'ARCHIVED'

export function ArchiveWarehouseDossiersByTypePage() {
  const { t, i18n } = useTranslation('archive-warehouse')
  const { dossierTypeId } = routeApi.useParams()
  const search = routeApi.useSearch() as unknown as ArchiveWarehouseDossiersByTypeSearchT
  const navigate = routeApi.useNavigate()
  const dateLocale = i18n.language.startsWith('vi') ? 'vi' : 'en'

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const year = search.year
  const status = search.status ?? DEFAULT_STATUS

  const [inputValue, setInputValue] = useState(q)

  const { data: dossierTypesData } = useQuery(archiveWarehouseDossierTypesQueryOptions())
  const dossierTypeName =
    dossierTypesData?.items.find((item) => item.id === dossierTypeId)?.name ??
    dossierTypeId

  const summaryParams = { dossierTypeId, status }
  const listParams = {
    dossierTypeId,
    page,
    limit,
    search: q || undefined,
    year,
    status,
  }

  const {
    data: summaryData,
    isError: isSummaryError,
    error: summaryError,
  } = useQuery(archiveWarehouseDossierTypeSummaryQueryOptions(summaryParams))

  const {
    data,
    isPending,
    isFetching,
    isError: isListError,
    error: listError,
  } = useQuery(archiveWarehouseDossiersByTypeQueryOptions(listParams))

  const items = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const listLoading = isPending || isFetching
  const hasActiveFilters = Boolean(q) || year != null

  useEffect(() => {
    setInputValue(q)
  }, [q])

  useEffect(() => {
    if (listLoading || !data) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [safePage, page, navigate, listLoading, data])

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

  function openDossierDetail(dossierId: string, fondId: string | null) {
    void navigate({
      to: '/app/archive-dossiers/$fondId/$dossierId',
      params: {
        fondId: fondId ?? UNASSIGNED_WAREHOUSE_FOND_ID,
        dossierId,
      },
      search: {
        browseView: 'dossierTypes',
        dossierTypeId,
      },
    })
  }

  const forbiddenMessage =
    isSummaryError || isListError
      ? translateError(
          (summaryError ?? listError) instanceof Error
            ? (summaryError ?? listError)
            : new Error(t('errors.loadFailed')),
        )
      : null

  return (
    <ArchiveWarehouseDataShell
      activeTab="dossiers"
      showBrowseTabs
      browseView="dossierTypes"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto">
        <div className="shrink-0 space-y-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">
              {t('page.dossierTypeDossiersTitle', { name: dossierTypeName })}
            </h1>
            {!forbiddenMessage && summaryData ? (
              <div className="mt-1.5">
                <ArchiveWarehouseStatCards summary={summaryData} />
              </div>
            ) : null}
          </div>

          {forbiddenMessage ? (
            <Card className="border-destructive p-8 text-center text-sm text-destructive">
              {forbiddenMessage}
            </Card>
          ) : null}

          {!forbiddenMessage ? (
            <div className="flex flex-wrap items-end gap-3">
              <ListPageSearchInput
                value={inputValue}
                onChange={setInputValue}
                onSearch={submitSearch}
                placeholder={t('page.searchPlaceholder')}
                className="min-w-[220px] flex-1"
              />
              <Select
                value={year != null ? String(year) : 'all'}
                onValueChange={(value) => {
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      year: value === 'all' ? undefined : Number(value),
                      page: 1,
                    }),
                    replace: true,
                  })
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('filters.year')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allYears')}</SelectItem>
                  {(summaryData?.availableYears ?? []).map((itemYear) => (
                    <SelectItem key={itemYear} value={String(itemYear)}>
                      {itemYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {!forbiddenMessage ? (
          <div className="flex flex-col gap-3">
            {listLoading && items.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : null}

            {!listLoading && summaryData?.dossierCount === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                {t('page.dossierTypeEmpty')}
              </Card>
            ) : null}

            {!listLoading &&
            summaryData &&
            summaryData.dossierCount > 0 &&
            items.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                {hasActiveFilters ? t('page.noMatch') : t('page.dossierTypeEmpty')}
              </Card>
            ) : null}

            {!listLoading && items.length > 0 ? (
              <div className="overflow-hidden rounded-lg border">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('table.name')}</TableHead>
                      <TableHead>{t('table.fond')}</TableHead>
                      <TableHead>{t('table.physicalLocation')}</TableHead>
                      <TableHead>{t('table.documentCount')}</TableHead>
                      <TableHead>{t('table.archivedAt')}</TableHead>
                      <TableHead>{t('table.path')}</TableHead>
                      <TableHead>{t('table.archiveStorageState')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => openDossierDetail(item.id, item.fondId)}
                      >
                        <TableCell className="truncate font-medium">{item.name}</TableCell>
                        <TableCell className="truncate">{item.fondName ?? '—'}</TableCell>
                        <TableCell>
                          {item.hasPhysicalPlacement ? (
                            <span className="text-sm">
                              {item.physicalBoxName ?? '—'}
                            </span>
                          ) : (
                            <Badge variant="secondary">
                              {t('table.physicalUnplaced')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{item.documentCount}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {item.archivedAt
                            ? formatDate(item.archivedAt, 'P', dateLocale)
                            : '—'}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-muted-foreground">
                          {item.folderPath ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {t(`archiveStorageState.${item.archiveStorageState}`)}
                          </Badge>
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
          </div>
        ) : null}
      </div>
    </ArchiveWarehouseDataShell>
  )
}
