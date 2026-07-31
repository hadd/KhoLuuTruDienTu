import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Download, Loader2, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useWarehouseDisposalPicker } from '@/features/archive-disposal/hooks/useWarehouseDisposalPicker'
import { buildWarehousePickerRouteSearch } from '@/features/archive-disposal/lib/warehousePickerSelection'
import { ArchiveWarehouseDataShell } from '@/features/archive-warehouse/components/ArchiveWarehouseDataShell'
import { ArchiveWarehouseDrillDownHeader } from '@/features/archive-warehouse/components/ArchiveWarehouseDrillDownHeader'
import { ArchiveWarehouseExportDialog } from '@/features/archive-warehouse/components/ArchiveWarehouseExportDialog'
import { ArchiveWarehouseSearchResults } from '@/features/archive-warehouse/components/ArchiveWarehouseSearchResults'
import { buildWarehouseSearchApiParams } from '@/features/archive-warehouse/components/ArchiveWarehouseSearchFilters'
import { ArchiveWarehouseStatCards } from '@/features/archive-warehouse/components/ArchiveWarehouseStatCards'
import { buildArchiveDossierDetailSearch } from '@/features/archive-warehouse/lib/archiveDossierDetailNavigation'
import { canExportDossiers } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { buildSimplifiedBrowseBreadcrumbSegments } from '@/features/archive-warehouse/lib/archiveWarehouseBreadcrumb'
import { UNASSIGNED_WAREHOUSE_FOND_ID } from '@/features/archive-warehouse/lib/unassignedFond'
import {
  archiveWarehouseDossierTypeSummaryQueryOptions,
  archiveWarehouseDossierTypesQueryOptions,
  archiveWarehouseDossiersByTypeQueryOptions,
  archiveWarehouseSearchQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { ArchiveWarehouseDossiersByTypeSearchT } from '@/features/archive-warehouse/schemas'
import type { WarehouseDossierStatusT } from '@/features/archive-warehouse/types'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi(
  '/app/archive-dossiers/by-dossier-type/$dossierTypeId/',
)

const DEFAULT_STATUS: WarehouseDossierStatusT = 'ARCHIVED'

export function ArchiveWarehouseDossiersByTypePage() {
  const { t, i18n } = useTranslation('archive-warehouse')
  const { t: tDisposal } = useTranslation('archive-disposal')
  const { dossierTypeId } = routeApi.useParams()
  const search =
    routeApi.useSearch() as unknown as ArchiveWarehouseDossiersByTypeSearchT
  const navigate = routeApi.useNavigate()
  const dateLocale = i18n.language.startsWith('vi') ? 'vi' : 'en'

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const year = search.year
  const status = search.status ?? DEFAULT_STATUS
  const pickerMode = search.pickerMode === true
  const disposalCatalogId = search.disposalCatalogId

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
  const showDownload = canExportDossiers(permissions) && !pickerMode

  const {
    showPickerSelection,
    showRowSelection,
    pickerTransferMutation,
    transferItems,
  } = useWarehouseDisposalPicker({
    pickerMode,
    disposalCatalogId,
    isEsSearchActive: Boolean(q.trim()),
    showDownload,
    onTransferSuccess: () => setSelectedIds(new Set()),
  })

  const { data: dossierTypesData } = useQuery(
    archiveWarehouseDossierTypesQueryOptions(),
  )
  const dossierTypeName =
    dossierTypesData?.items.find((item) => item.id === dossierTypeId)?.name ??
    dossierTypeId

  const summaryParams = { dossierTypeId, status }
  const isEsSearchActive = Boolean(q.trim())
  const searchParams = isEsSearchActive
    ? buildWarehouseSearchApiParams({ q, dossierTypeId }, { page, limit })
    : null
  const listParams = {
    dossierTypeId,
    page,
    limit,
    search: !isEsSearchActive && q ? q : undefined,
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

  const {
    data: searchData,
    isPending: isSearchPending,
    isFetching: isSearchFetching,
  } = useQuery(archiveWarehouseSearchQueryOptions(searchParams))

  const items = isEsSearchActive ? [] : (data?.items ?? [])
  const searchItems = isEsSearchActive ? (searchData?.items ?? []) : []
  const totalPages = isEsSearchActive
    ? Math.max(1, Math.ceil((searchData?.total ?? 0) / limit) || 1)
    : Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const listLoading = isEsSearchActive
    ? isSearchPending || isSearchFetching
    : isPending || isFetching
  const hasActiveFilters = Boolean(q) || year != null
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
  }, [dossierTypeId, q, year, status, page, limit])

  useEffect(() => {
    if (listLoading) return
    const hasData = isEsSearchActive ? Boolean(searchData) : Boolean(data)
    if (!hasData) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [
    safePage,
    page,
    navigate,
    listLoading,
    data,
    searchData,
    isEsSearchActive,
  ])

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

  function navigateBackToBrowseList() {
    void navigate({
      to: '/app/archive-warehouse',
      search: {
        tab: 'dossiers',
        browseView: 'dossierTypes',
        page: 1,
        ...buildWarehousePickerRouteSearch({ pickerMode, disposalCatalogId }),
      },
    })
  }

  function openSearchHit(
    hit: { entityId: string; fondId?: string | null },
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
      params: {
        fondId: hit.fondId ?? UNASSIGNED_WAREHOUSE_FOND_ID,
        dossierId: hit.entityId,
      },
      search: buildArchiveDossierDetailSearch(
        { browseView: 'dossierTypes', dossierTypeId },
        {
          fileName: match?.fileName ?? undefined,
          highlightPage: match?.page && match.page > 0 ? match.page : undefined,
          highlightBbox,
        },
      ),
    })
  }

  function openDossierDetail(dossierId: string, fondId: string | null) {
    void navigate({
      to: '/app/archive-dossiers/$fondId/$dossierId',
      params: {
        fondId: fondId ?? UNASSIGNED_WAREHOUSE_FOND_ID,
        dossierId,
      },
      search: buildArchiveDossierDetailSearch({
        browseView: 'dossierTypes',
        dossierTypeId,
      }),
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
    isSummaryError || isListError
      ? translateError(
          (summaryError ?? listError) instanceof Error
            ? (summaryError ?? listError)
            : new Error(t('errors.loadFailed')),
        )
      : null

  return (
    <ArchiveWarehouseDataShell>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto">
        <div className="shrink-0 space-y-3">
          <ArchiveWarehouseDrillDownHeader
            segments={buildSimplifiedBrowseBreadcrumbSegments({
              listLabel: t('page.dossierTypeDossiersTitle', {
                name: dossierTypeName,
              }),
            })}
            onBack={navigateBackToBrowseList}
            backAriaLabel={t('page.backToFonds')}
          />
          {!forbiddenMessage && summaryData ? (
            <ArchiveWarehouseStatCards summary={summaryData} />
          ) : null}

          {forbiddenMessage ? (
            <Card className="border-destructive p-8 text-center text-sm text-destructive">
              {forbiddenMessage}
            </Card>
          ) : null}

          {showPickerSelection ? (
            <Card className="border-primary/30 bg-primary/5 p-3 text-sm">
              {tDisposal('disposal.pickerHint')}
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
              {!isEsSearchActive && items.length > 0 && (showPickerSelection || showDownload) ? (
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {hasSelection ? (
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {t('export.selectedCount', {
                        count: selectedDossierIds.length,
                      })}
                    </span>
                  ) : null}
                  {showPickerSelection ? (
                    <Button
                      type="button"
                      disabled={
                        !hasSelection ||
                        pickerTransferMutation.isPending ||
                        !disposalCatalogId
                      }
                      onClick={() => {
                        transferItems(
                          selectedDossierIds.map((dossierId) => ({
                            dossierId,
                            source: 'WAREHOUSE' as const,
                          })),
                        )
                      }}
                    >
                      {pickerTransferMutation.isPending ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 size-4" />
                      )}
                      {tDisposal('disposal.addToCatalog', { count: selectedCount })}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="default"
                      disabled={!hasSelection}
                      onClick={() => setExportDialogOpen(true)}
                    >
                      <Download className="mr-2 size-4" aria-hidden />
                      {t('export.downloadButton')}
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {!forbiddenMessage ? (
          <div className="flex flex-col gap-3">
            {isEsSearchActive ? (
              <>
                <ArchiveWarehouseSearchResults
                  items={searchItems}
                  isLoading={listLoading}
                  tookMs={searchData?.took_ms}
                  message={searchData?.message}
                  mode={searchParams?.mode}
                  onSelect={(hit, match) => openSearchHit(hit, match)}
                />
                {searchItems.length > 0 ? (
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
                        search: (prev) => ({
                          ...prev,
                          limit: nextLimit,
                          page: 1,
                        }),
                        replace: true,
                      })
                    }}
                  />
                ) : null}
              </>
            ) : null}

            {!isEsSearchActive && listLoading && items.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : null}

            {!isEsSearchActive &&
            !listLoading &&
            summaryData?.dossierCount === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                {t('page.dossierTypeEmpty')}
              </Card>
            ) : null}

            {!isEsSearchActive &&
            !listLoading &&
            summaryData &&
            summaryData.dossierCount > 0 &&
            items.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                {hasActiveFilters
                  ? t('page.noMatch')
                  : t('page.dossierTypeEmpty')}
              </Card>
            ) : null}

            {!isEsSearchActive && !listLoading && items.length > 0 ? (
              <div className="overflow-hidden rounded-lg border">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      {showRowSelection ? (
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
                        className={showPickerSelection ? undefined : 'cursor-pointer'}
                        onClick={
                          showPickerSelection
                            ? undefined
                            : () => openDossierDetail(item.id, item.fondId)
                        }
                      >
                        {showRowSelection ? (
                          <TableCell
                            className="w-10"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Checkbox
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={(checked) =>
                                toggleDossierSelection(
                                  item.id,
                                  checked === true,
                                )
                              }
                              aria-label={t('table.select')}
                            />
                          </TableCell>
                        ) : null}
                        <TableCell className="truncate font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell className="truncate">
                          {item.fondName ?? '—'}
                        </TableCell>
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
                            {t(
                              `archiveStorageState.${item.archiveStorageState}`,
                            )}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {!isEsSearchActive && items.length > 0 ? (
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

      <ArchiveWarehouseExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        dossierIds={selectedDossierIds}
        dossierNames={selectedDossierIds.map(
          (id) => items.find((item) => item.id === id)?.name ?? '',
        )}
        onExported={() => setSelectedIds(new Set())}
      />
    </ArchiveWarehouseDataShell>
  )
}
