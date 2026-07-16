import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { ArchiveWarehouseExportDialog } from '@/features/archive-warehouse/components/ArchiveWarehouseExportDialog'
import { ArchiveWarehouseStatCards } from '@/features/archive-warehouse/components/ArchiveWarehouseStatCards'
import {
  ArchiveWarehouseSearchFilters,
  buildWarehouseSearchApiParams,
  hasWarehouseFilterCriteria,
} from '@/features/archive-warehouse/components/ArchiveWarehouseSearchFilters'
import { ArchiveWarehouseSearchResults } from '@/features/archive-warehouse/components/ArchiveWarehouseSearchResults'
import {
  canDownloadAny,
  canDownloadOriginal,
  canDownloadWatermark,
} from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import {
  archiveWarehouseDossiersQueryOptions,
  archiveWarehouseFondSummaryQueryOptions,
  archiveWarehouseFondsQueryOptions,
  archiveWarehouseSearchQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { ArchiveWarehouseFondDossiersSearchT } from '@/features/archive-warehouse/schemas'
import type { WarehouseDossierStatusT } from '@/features/archive-warehouse/types'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-dossiers/$fondId/')

const DEFAULT_STATUS: WarehouseDossierStatusT = 'ARCHIVED'

type DateLocale = 'en' | 'vi'

function toDateLocale(language: string): DateLocale {
  return language.startsWith('vi') ? 'vi' : 'en'
}

export function ArchiveWarehouseDossiersPage() {
  const { t, i18n } = useTranslation('archive-warehouse')
  const { fondId } = routeApi.useParams()
  const search = routeApi.useSearch() as ArchiveWarehouseFondDossiersSearchT
  const navigate = routeApi.useNavigate()
  const dateLocale = toDateLocale(i18n.language)

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const year = search.year
  const status = search.status ?? DEFAULT_STATUS

  const [inputValue, setInputValue] = useState(q)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  const { data: profile } = useQuery(profileQueryOptions)
  const roleId = getCurrentUserRoleId(profile)
  const { data: rolePermissions } = useQuery({
    ...rolePermissionsQueryOptions(roleId ?? ''),
    enabled: Boolean(roleId),
  })
  const permissions = useMemo(
    () =>
      resolvePermissionsForUser(profile, rolePermissions?.rules.permissions),
    [profile, rolePermissions?.rules.permissions],
  )

  const showDownload = canDownloadAny(permissions)

  const { data: fondsData } = useQuery(archiveWarehouseFondsQueryOptions())
  const fondName =
    fondsData?.items.find((fond) => fond.id === fondId)?.fondName ?? fondId

  const filterValues = {
    q,
    dossierTypeId: search.dossierTypeId,
    documentTypeId: search.documentTypeId,
    editorName: search.editorName,
    editCompletedAtFrom: search.editCompletedAtFrom,
    editCompletedAtTo: search.editCompletedAtTo,
    archivedAtFrom: search.archivedAtFrom,
    archivedAtTo: search.archivedAtTo,
  }

  const isEsSearchActive = hasWarehouseFilterCriteria(filterValues)

  const listParams = {
    fondId,
    page,
    limit,
    search: !isEsSearchActive && q ? q : undefined,
    year,
    status,
  }

  const summaryParams = { fondId, status }
  const searchParams = isEsSearchActive
    ? buildWarehouseSearchApiParams(filterValues, {
      page,
      limit,
      lockedFondId: fondId,
    })
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
  } = useQuery({
    ...archiveWarehouseDossiersQueryOptions(listParams),
    enabled: !isEsSearchActive,
  })

  const {
    data: searchData,
    isPending: isSearchPending,
    isFetching: isSearchFetching,
    isError: isSearchError,
    error: searchError,
  } = useQuery(archiveWarehouseSearchQueryOptions(searchParams))

  const items = isEsSearchActive ? [] : (data?.items ?? [])
  const searchItems = isEsSearchActive ? (searchData?.items ?? []) : []
  const totalPages = Math.max(
    1,
    isEsSearchActive
      ? Math.ceil((searchData?.total ?? 0) / limit) || 1
      : (data?.totalPages ?? 1),
  )
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const hasActiveFilters = Boolean(q) || year != null || isEsSearchActive
  const listLoading = isEsSearchActive
    ? isSearchPending || isSearchFetching
    : isPending || isFetching

  const selectableIds = items.map((item) => item.id)
  const selectedCount = selectableIds.filter((id) => selectedIds.has(id)).length
  const allSelected =
    selectableIds.length > 0 && selectedCount === selectableIds.length
  const someSelected = selectedCount > 0 && selectedCount < selectableIds.length
  const selectedDossierIds = Array.from(selectedIds)
  const hasSelection = selectedDossierIds.length > 0

  useEffect(() => {
    setInputValue(q)
  }, [q])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [
    fondId,
    q,
    year,
    status,
    search.dossierTypeId,
    search.documentTypeId,
    search.editorName,
    search.editCompletedAtFrom,
    search.editCompletedAtTo,
    search.archivedAtFrom,
    search.archivedAtTo,
  ])

  useEffect(() => {
    if (listLoading) return
    if (isEsSearchActive ? !searchData : !data) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [safePage, page, navigate, listLoading, data, searchData, isEsSearchActive])

  function submitSearch() {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: inputValue.trim() ? inputValue.trim() : undefined,
        page: 1,
        mode: inputValue.trim() ? 'content' : 'metadata',
      }),
      replace: true,
    })
  }

  function clearFilters() {
    setInputValue('')
    void navigate({
      search: {
        page: 1,
        limit,
        status: DEFAULT_STATUS,
      },
      replace: true,
    })
  }

  function handleListBrowseFiltersChange(patch: {
    year?: number
    status?: WarehouseDossierStatusT
  }) {
    void navigate({
      search: (prev) => ({
        ...prev,
        year: patch.year,
        status: patch.status ?? (prev as ArchiveWarehouseFondDossiersSearchT).status ?? DEFAULT_STATUS,
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

  function toggleDossierSelection(dossierId: string, checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) {
      next.add(dossierId)
    } else {
      next.delete(dossierId)
    }
    setSelectedIds(next)
  }

  function toggleSelectAllOnPage(checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) {
      selectableIds.forEach((id) => next.add(id))
    } else {
      selectableIds.forEach((id) => next.delete(id))
    }
    setSelectedIds(next)
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div className="shrink-0 space-y-4 overflow-visible">
        <div className="flex flex-col items-start gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/archive-warehouse" search={{ tab: 'dossiers' }}>
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
          <ArchiveWarehouseSearchFilters
            values={filterValues}
            searchInput={inputValue}
            onSearchInputChange={setInputValue}
            onSubmitSearch={submitSearch}
            onChange={(patch) => {
              void navigate({
                search: (prev) => ({
                  ...prev,
                  ...patch,
                  page: 1,
                }),
                replace: true,
              })
            }}
            onClear={clearFilters}
            lockedFondId={fondId}
            listBrowseFilters={{
              year,
              status,
              availableYears: summaryData?.availableYears ?? [],
              disableYear: isEsSearchActive,
            }}
            onListBrowseFiltersChange={handleListBrowseFiltersChange}
            trailing={
              !isEsSearchActive && items.length > 0 && showDownload ? (
                <>
                  {hasSelection ? (
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {t('export.selectedCount', {
                        count: selectedDossierIds.length,
                      })}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="default"
                    disabled={!hasSelection}
                    onClick={() => setExportDialogOpen(true)}
                  >
                    <Download className="mr-2 size-4" aria-hidden />
                    {t('export.downloadButton')}
                  </Button>
                </>
              ) : undefined
            }
          />
        ) : null}
      </div>

      {!forbiddenMessage ? (
        <div className="flex flex-col gap-3">
          {listLoading && items.length === 0 && searchItems.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {!listLoading &&
            !isEsSearchActive &&
            summaryData?.dossierCount === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {t('page.fondEmpty')}
            </Card>
          ) : null}

          {!listLoading &&
            !isEsSearchActive &&
            summaryData &&
            summaryData.dossierCount > 0 &&
            items.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {hasActiveFilters ? t('page.noMatch') : t('page.fondEmpty')}
            </Card>
          ) : null}

          {isEsSearchActive ? (
            <div>
              <ArchiveWarehouseSearchResults
                items={searchItems}
                isLoading={listLoading}
                tookMs={searchData?.took_ms}
                message={searchData?.message}
                mode={searchParams?.mode}
                onSelect={(hit, match) => openDossierDetail(hit.entityId, match)}
              />
            </div>
          ) : null}

          {!isEsSearchActive && items.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {showDownload ? (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            allSelected
                              ? true
                              : someSelected
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(checked) =>
                            toggleSelectAllOnPage(checked === true)
                          }
                          aria-label={t('table.selectAll')}
                        />
                      </TableHead>
                    ) : null}
                    <TableHead>{t('table.name')}</TableHead>
                    <TableHead>{t('table.physicalLocation')}</TableHead>
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
                      {showDownload ? (
                        <TableCell
                          className="w-10"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={(checked) =>
                              toggleDossierSelection(item.id, checked === true)
                            }
                            aria-label={t('table.select')}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        {item.hasPhysicalPlacement ? (
                          <Badge variant="outline">
                            {t('table.physicalPlaced')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {t('table.physicalUnplaced')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.documentCount}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {item.archivedAt
                          ? formatDate(item.archivedAt, 'PPp', dateLocale)
                          : '—'}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">
                        {item.folderPath ?? '—'}
                      </TableCell>
                      <TableCell>{item.projectCode ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.status === 'ARCHIVED'
                            ? t('status.ARCHIVED')
                            : item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {items.length > 0 || searchItems.length > 0 ? (
            <div className="shrink-0">
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
            </div>
          ) : null}
        </div>
      ) : null}

      <ArchiveWarehouseExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        dossierIds={selectedDossierIds}
        dossierNames={selectedDossierIds.map(
          (id) => items.find((item) => item.id === id)?.name ?? '',
        ).filter(Boolean)}
        onExported={() => setSelectedIds(new Set())}
        allowOriginalDownload={canDownloadOriginal(permissions)}
        allowWatermarkDownload={canDownloadWatermark(permissions)}
      />
    </div>
  )
}
