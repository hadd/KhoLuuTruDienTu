import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Loader2, Plus, FileText, FolderOpen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  stickyTableHeaderClassName,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { buildWarehousePickerRouteSearch } from '@/features/archive-disposal/lib/warehousePickerSelection'
import { useWarehouseDisposalPicker } from '@/features/archive-disposal/hooks/useWarehouseDisposalPicker'
import { ArchiveWarehouseCatalogGrid } from '@/features/archive-warehouse/components/ArchiveWarehouseCatalogGrid'
import { ArchiveWarehouseFondGrid } from '@/features/archive-warehouse/components/ArchiveWarehouseFondGrid'
import { ArchiveWarehouseUnassignedSection } from '@/features/archive-warehouse/components/ArchiveWarehouseUnassignedSection'
import {
  ArchiveWarehouseSearchFilters,
  buildWarehouseSearchApiParams,
  isDbBrowseWarehouseFilter,
  isEsWarehouseSearchRequired,
  isFlatWarehouseListBrowse,
  resolveWarehouseDossierTypeIds,
  resolveWarehouseFondIds,
} from '@/features/archive-warehouse/components/ArchiveWarehouseSearchFilters'
import { ArchiveWarehouseSortableTableHead } from '@/features/archive-warehouse/components/ArchiveWarehouseSortableTableHead'
import {
  toggleWarehouseBrowseSort,
  type WarehouseDossierBrowseSortFieldT,
} from '@/features/archive-warehouse/lib/warehouseBrowseSort'
import { ArchiveWarehouseSearchResults } from '@/features/archive-warehouse/components/ArchiveWarehouseSearchResults'
import { buildArchiveDossierDetailSearch } from '@/features/archive-warehouse/lib/archiveDossierDetailNavigation'
import {
  readManageByFondPreference,
  writeManageByFondPreference,
} from '@/features/archive-warehouse/lib/manageByFondPreference'
import { UNASSIGNED_WAREHOUSE_FOND_ID } from '@/features/archive-warehouse/lib/unassignedFond'
import { profileQueryOptions } from '@/features/auth/queries'
import {
  archiveWarehouseDossierDetailQueryOptions,
  archiveWarehouseDossiersQueryOptions,
  archiveWarehouseDossierTypesQueryOptions,
  archiveWarehouseDocumentTypesQueryOptions,
  archiveWarehouseFondsQueryOptions,
  archiveWarehouseSearchQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { ArchiveDataHubSearchT } from '@/features/archive-warehouse/schemas'
import type { WarehouseDossierStatusT } from '@/features/archive-warehouse/types'
import { verifyDossierAccess } from '@/features/security-level/api/securityLevelClient'
import { SecurityAccessPasswordDialog } from '@/features/security-level/components/SecurityAccessPasswordDialog'
import { getPasswordRequiredFromError } from '@/features/security-level/lib/passwordRequired'
import {
  rememberDossierSecurityLevel,
  setDossierAccessToken,
} from '@/features/security-level/lib/securityAccessTokenStore'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-warehouse/')
const DEFAULT_STATUS: WarehouseDossierStatusT = 'ARCHIVED'

type DateLocale = 'en' | 'vi'

function toDateLocale(lang: string): DateLocale {
  return lang.startsWith('vi') ? 'vi' : 'en'
}

function resolveFondIds(searchFondId: string | string[] | undefined): string[] {
  return resolveWarehouseFondIds(searchFondId)
}

function resolveDossierTypeIds(
  dossierTypeId: string | string[] | undefined,
): string[] {
  return resolveWarehouseDossierTypeIds(dossierTypeId)
}

type DossierOpenMatchT = {
  fileName?: string | null
  page?: number | null
  bbox?: number[] | null
}

type PendingDossierOpenT = {
  dossierId: string
  securityLevelId?: string | null
  fondId?: string | null
  match?: DossierOpenMatchT
}

interface ArchiveWarehouseFondsPageProps {
  embedded?: boolean
}

export function ArchiveWarehouseFondsPage({
  embedded: _embedded = false,
}: ArchiveWarehouseFondsPageProps) {
  const { t, i18n } = useTranslation('archive-warehouse')
  const { t: tDisposal } = useTranslation('archive-disposal')
  const { t: tSecurity } = useTranslation('security-level')
  const queryClient = useQueryClient()
  const navigateToFond = useNavigate()
  const navigateToDetail = useNavigate()
  const search = routeApi.useSearch() as ArchiveDataHubSearchT
  const navigate = routeApi.useNavigate()
  const dateLocale = toDateLocale(i18n.language)
  const { data: profile } = useQuery(profileQueryOptions)

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const sortBy = search.sortBy
  const sortDir = search.sortDir
  const browseView = search.browseView ?? 'fonds'
  const manageByFond = search.manageByFond !== false
  const pickerMode = search.pickerMode === true
  const disposalCatalogId = search.disposalCatalogId
  const filterFondIds = resolveFondIds(search.searchFondId)
  const filterDossierTypeIds = resolveDossierTypeIds(search.dossierTypeId)

  const [inputValue, setInputValue] = useState(q)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [openingDossierId, setOpeningDossierId] = useState<string | null>(null)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [pendingOpen, setPendingOpen] = useState<PendingDossierOpenT | null>(
    null,
  )

  const filterValues = {
    q,
    searchFondId: search.searchFondId,
    dossierTypeId: search.dossierTypeId,
    documentTypeId: search.documentTypeId,
    searchFields: search.searchFields,
    editorName: search.editorName,
    editCompletedAtFrom: search.editCompletedAtFrom,
    editCompletedAtTo: search.editCompletedAtTo,
    archivedAtFrom: search.archivedAtFrom,
    archivedAtTo: search.archivedAtTo,
  }

  const metadataFilterValues = { ...filterValues, q: undefined }
  const isDbBrowseActive = isDbBrowseWarehouseFilter(metadataFilterValues)
  const isFlatListBrowse = isFlatWarehouseListBrowse(
    manageByFond,
    metadataFilterValues,
  )
  const isBrowseListActive = isDbBrowseActive || isFlatListBrowse
  const isEsSearchActive = isEsWarehouseSearchRequired(filterValues)
  const showFilterResults = isBrowseListActive || isEsSearchActive
  const showBrowseGrids = manageByFond && !showFilterResults

  useEffect(() => {
    if (!profile?.id) return
    if (search.manageByFond !== undefined) return

    const stored = readManageByFondPreference(profile.id)
    if (stored) return

    void navigate({
      search: (prev) => ({
        ...prev,
        manageByFond: false,
        tab: 'dossiers',
      }),
      replace: true,
    })
  }, [navigate, profile?.id, search.manageByFond])

  useEffect(() => {
    if (!manageByFond || search.browseView) return
    void navigate({
      search: (prev) => ({ ...prev, browseView: 'fonds', tab: 'dossiers' }),
      replace: true,
    })
  }, [manageByFond, navigate, search.browseView])

  const { data: fondsData, isPending: isFondsPending } = useQuery(
    archiveWarehouseFondsQueryOptions(),
  )
  const sortedFonds = useMemo(
    () =>
      [...(fondsData?.items ?? [])].sort((a, b) =>
        a.fondName.localeCompare(b.fondName, 'vi'),
      ),
    [fondsData?.items],
  )

  const { data: dossierTypesData, isPending: isDossierTypesPending } = useQuery({
    ...archiveWarehouseDossierTypesQueryOptions(),
    enabled: showBrowseGrids && browseView === 'dossierTypes',
  })
  const { data: documentTypesData, isPending: isDocumentTypesPending } =
    useQuery({
      ...archiveWarehouseDocumentTypesQueryOptions(),
      enabled: showBrowseGrids && browseView === 'documentTypes',
    })

  const sortedDossierTypes = useMemo(
    () =>
      [...(dossierTypesData?.items ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, 'vi'),
      ),
    [dossierTypesData?.items],
  )

  const sortedDocumentTypes = useMemo(
    () =>
      [...(documentTypesData?.items ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, 'vi'),
      ),
    [documentTypesData?.items],
  )

  useEffect(() => {
    if (
      !manageByFond ||
      showFilterResults ||
      browseView !== 'fonds' ||
      isFondsPending ||
      sortedFonds.length !== 1 ||
      !sortedFonds[0]
    ) {
      return
    }
    void navigateToFond({
      to: '/app/archive-dossiers/$fondId',
      params: { fondId: sortedFonds[0].id },
      search: buildWarehousePickerRouteSearch({
        pickerMode,
        disposalCatalogId,
        page: 1,
      }),
    })
  }, [
    browseView,
    disposalCatalogId,
    isFondsPending,
    manageByFond,
    navigateToFond,
    pickerMode,
    showFilterResults,
    sortedFonds,
  ])

  useEffect(() => {
    if (
      !manageByFond ||
      showFilterResults ||
      browseView !== 'dossierTypes' ||
      isDossierTypesPending ||
      sortedDossierTypes.length !== 1 ||
      !sortedDossierTypes[0]
    ) {
      return
    }
    void navigateToFond({
      to: '/app/archive-dossiers/by-dossier-type/$dossierTypeId',
      params: { dossierTypeId: sortedDossierTypes[0].id },
      search: buildWarehousePickerRouteSearch({
        pickerMode,
        disposalCatalogId,
        page: 1,
      }),
    })
  }, [
    browseView,
    disposalCatalogId,
    isDossierTypesPending,
    manageByFond,
    navigateToFond,
    pickerMode,
    showFilterResults,
    sortedDossierTypes,
  ])

  useEffect(() => {
    if (
      !manageByFond ||
      showFilterResults ||
      browseView !== 'documentTypes' ||
      isDocumentTypesPending ||
      sortedDocumentTypes.length !== 1 ||
      !sortedDocumentTypes[0]
    ) {
      return
    }
    void navigateToFond({
      to: '/app/archive-dossiers/by-document-type/$documentTypeId',
      params: { documentTypeId: sortedDocumentTypes[0].id },
      search: buildWarehousePickerRouteSearch({
        pickerMode,
        disposalCatalogId,
        page: 1,
      }),
    })
  }, [
    browseView,
    disposalCatalogId,
    isDocumentTypesPending,
    manageByFond,
    navigateToFond,
    pickerMode,
    showFilterResults,
    sortedDocumentTypes,
  ])

  const {
    showPickerSelection,
    showRowSelection,
    pickerTransferMutation,
    transferItems,
  } = useWarehouseDisposalPicker({
    pickerMode,
    disposalCatalogId,
    isEsSearchActive,
    onTransferSuccess: () => setSelectedIds(new Set()),
  })

  const browseParams = isBrowseListActive
    ? {
        page,
        limit,
        fondId: filterFondIds.length > 0 ? filterFondIds : undefined,
        dossierTypeId:
          filterDossierTypeIds.length > 0 ? filterDossierTypeIds : undefined,
        search: q || undefined,
        status: DEFAULT_STATUS,
        sortBy,
        sortDir,
      }
    : null

  function handleBrowseSortChange(field: WarehouseDossierBrowseSortFieldT) {
    const next = toggleWarehouseBrowseSort({ sortBy, sortDir }, field)
    void navigate({
      search: (prev) => ({ ...prev, ...next, page: 1 }),
    })
  }

  const searchParams = isEsSearchActive
    ? buildWarehouseSearchApiParams(filterValues, { page, limit })
    : null

  const {
    data,
    isPending,
    isFetching,
    isError: isListError,
    error: listError,
  } = useQuery({
    ...archiveWarehouseDossiersQueryOptions(browseParams),
    enabled: isBrowseListActive,
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
  const listLoading = isEsSearchActive
    ? isSearchPending || isSearchFetching
    : isPending || isFetching
  const selectedDossierIds = [...selectedIds]
  const hasSelection = selectedDossierIds.length > 0
  const selectedCount = selectedDossierIds.length
  const allSelected =
    showRowSelection && items.length > 0 && items.every((item) => selectedIds.has(item.id))
  const someSelected =
    showRowSelection && items.some((item) => selectedIds.has(item.id)) && !allSelected

  useEffect(() => {
    setInputValue(q)
  }, [q])

  useEffect(() => {
    if (listLoading) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [safePage, page, navigate, listLoading])

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

  function clearFilters() {
    setInputValue('')
    void navigate({
      search: (prev) => ({
        tab: 'dossiers',
        browseView: prev.manageByFond === false ? undefined : (prev.browseView ?? 'fonds'),
        manageByFond: prev.manageByFond,
        page: 1,
        limit,
        ...(pickerMode
          ? { pickerMode: true, disposalCatalogId }
          : {}),
      }),
      replace: true,
    })
  }

  function setManageByFond(next: boolean) {
    writeManageByFondPreference(profile?.id, next)
    void navigate({
      search: (prev) => ({
        ...prev,
        manageByFond: next ? undefined : false,
        searchFondId: next ? undefined : prev.searchFondId,
        browseView: next ? 'fonds' : undefined,
        page: 1,
      }),
      replace: true,
    })
  }

  function navigateToDossierDetail(
    dossierId: string,
    fondId?: string | null,
    match?: DossierOpenMatchT,
  ) {
    const highlightBbox =
      match?.bbox && match.bbox.length >= 4
        ? match.bbox.slice(0, 4).join(',')
        : undefined
    void navigateToDetail({
      to: '/app/archive-dossiers/$fondId/$dossierId',
      params: {
        fondId: fondId ?? UNASSIGNED_WAREHOUSE_FOND_ID,
        dossierId,
      },
      search: buildArchiveDossierDetailSearch(
        filterDossierTypeIds.length > 0
          ? {
              browseView: 'dossierTypes',
              dossierTypeId:
                filterDossierTypeIds.length === 1
                  ? filterDossierTypeIds[0]
                  : undefined,
            }
          : { browseView: 'fonds' },
        {
          fileName: match?.fileName ?? undefined,
          highlightPage: match?.page && match.page > 0 ? match.page : undefined,
          highlightBbox,
        },
      ),
      state: { fromArchiveWarehouseList: true },
    })
  }

  async function openDossierDetail(
    dossierId: string,
    fondId?: string | null,
    match?: DossierOpenMatchT,
    securityLevelId?: string | null,
  ) {
    if (openingDossierId || passwordDialogOpen) return

    if (securityLevelId) {
      rememberDossierSecurityLevel('warehouse', dossierId, securityLevelId)
    }

    setOpeningDossierId(dossierId)
    try {
      await queryClient.fetchQuery(
        archiveWarehouseDossierDetailQueryOptions(dossierId, securityLevelId),
      )
      navigateToDossierDetail(dossierId, fondId, match)
    } catch (err) {
      const passwordRequired = getPasswordRequiredFromError(err)
      if (passwordRequired?.scope === 'dossier') {
        setPendingOpen({ dossierId, securityLevelId, fondId, match })
        setPasswordDialogOpen(true)
        return
      }
      toast.error(translateError(err) || t('errors.detailFailed'))
    } finally {
      setOpeningDossierId(null)
    }
  }

  const unlockMutation = useMutation({
    mutationFn: async (password: string) => {
      if (!pendingOpen) {
        throw new Error(tSecurity('access.unlockFailed'))
      }
      return verifyDossierAccess({
        dossierId: pendingOpen.dossierId,
        password,
      })
    },
    onSuccess: async (result) => {
      if (!pendingOpen) return
      const { dossierId, securityLevelId, fondId, match } = pendingOpen
      setDossierAccessToken('warehouse', dossierId, result.token, result.expiresIn)
      setPasswordDialogOpen(false)
      toast.success(tSecurity('access.unlockSuccess'))
      try {
        await queryClient.fetchQuery(
          archiveWarehouseDossierDetailQueryOptions(dossierId, securityLevelId),
        )
        setPendingOpen(null)
        navigateToDossierDetail(dossierId, fondId, match)
      } catch (err) {
        toast.error(translateError(err) || tSecurity('access.unlockFailed'))
      }
    },
    onError: (err) => {
      toast.error(translateError(err) || tSecurity('access.unlockFailed'))
    },
  })

  function toggleDossierSelection(dossierId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(dossierId)
      else next.delete(dossierId)
      return next
    })
  }

  function toggleSelectAllOnPage(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const item of items) {
        if (checked) next.add(item.id)
        else next.delete(item.id)
      }
      return next
    })
  }

  const forbiddenMessage =
    isListError || isSearchError
      ? listError instanceof Error
        ? listError.message
        : searchError instanceof Error
          ? searchError.message
          : t('errors.fondForbidden')
      : null

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 space-y-3 overflow-visible">
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
          <ArchiveWarehouseSearchFilters
            layout="compact"
            values={filterValues}
            hideFondFilter={manageByFond}
            searchInput={inputValue}
            onSearchInputChange={setInputValue}
            onSubmitSearch={submitSearch}
            searchPlaceholder={
              browseView === 'unassigned'
                ? t('page.searchPlaceholder')
                : undefined
            }
            onChange={(patch) => {
              if (browseView === 'unassigned') {
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    q:
                      patch && 'q' in patch
                        ? patch.q
                        : inputValue.trim() || undefined,
                    page: 1,
                  }),
                  replace: true,
                })
                return
              }
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
            fonds={sortedFonds}
            leading={
              <ListPageSearchInput
                className="w-96"
                value={inputValue}
                onChange={setInputValue}
                onSearch={submitSearch}
                placeholder={t('page.searchPlaceholder')}
              />
            }
            trailing={
              <>
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
                    {tDisposal('disposal.addToCatalog', {
                      count: selectedCount,
                    })}
                  </Button>
                ) : null}
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    id="warehouse-manage-by-fond"
                    checked={manageByFond}
                    onCheckedChange={setManageByFond}
                  />
                  <Label
                    htmlFor="warehouse-manage-by-fond"
                    className="cursor-pointer text-sm whitespace-nowrap"
                  >
                    {t('page.manageByFond')}
                  </Label>
                </div>
              </>
            }
          />
        ) : null}
      </div>

      {!forbiddenMessage ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {showFilterResults && listLoading && items.length === 0 && searchItems.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {showFilterResults &&
          !listLoading &&
          !isEsSearchActive &&
          items.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {isDbBrowseActive || isEsSearchActive || q.trim()
                ? t('page.noMatch')
                : t('page.dossiersEmpty')}
            </Card>
          ) : null}

          {showFilterResults && isEsSearchActive ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <ArchiveWarehouseSearchResults
                items={searchItems}
                isLoading={listLoading}
                tookMs={searchData?.took_ms}
                message={searchData?.message}
                mode={searchParams?.mode}
                searchFields={filterValues.searchFields}
                searchQuery={q}
                onSelect={(hit, match) => {
                  void openDossierDetail(hit.entityId, hit.fondId, match)
                }}
              />
            </div>
          ) : null}

          {showFilterResults && !isEsSearchActive && items.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
              <Table
                className="w-full table-fixed border-separate border-spacing-0"
                containerClassName="h-full min-h-0 overflow-auto"
              >
                <TableHeader className={stickyTableHeaderClassName}>
                  <TableRow className="hover:bg-muted">
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
                    <ArchiveWarehouseSortableTableHead
                      label={t('table.fond')}
                      field="fondName"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSortChange={handleBrowseSortChange}
                    />
                    <TableHead>{t('table.physicalLocation')}</TableHead>
                    <TableHead>{t('table.documentCount')}</TableHead>
                    <TableHead>{t('table.archivedAt')}</TableHead>
                    <ArchiveWarehouseSortableTableHead
                      label={t('table.dossierType')}
                      field="dossierTypeName"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSortChange={handleBrowseSortChange}
                    />
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
                          : () =>
                              void openDossierDetail(
                                item.id,
                                item.fondId,
                                undefined,
                                item.securityLevelId,
                              )
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
                              toggleDossierSelection(item.id, checked === true)
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
                      <TableCell className="truncate">
                        {item.dossierTypeName ?? '—'}
                      </TableCell>
                      <TableCell className="truncate">
                        {item.archiveStorageState
                          ? t(`archiveStorageState.${item.archiveStorageState}`)
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {showFilterResults && !listLoading && (items.length > 0 || searchItems.length > 0) ? (
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

          {showBrowseGrids && browseView === 'fonds' ? (
            <section className="min-h-0 flex-1 space-y-2 overflow-auto">
              {sortedFonds.length === 0 && !isFondsPending ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  {t('page.fondListEmpty')}
                </Card>
              ) : (
                <ArchiveWarehouseFondGrid
                  fonds={sortedFonds}
                  formatDossierCount={(count) =>
                    t('page.catalogDossierCount', { count })
                  }
                  onSelect={(fondId) => {
                    void navigateToFond({
                      to: '/app/archive-dossiers/$fondId',
                      params: { fondId },
                      search: buildWarehousePickerRouteSearch({
                        pickerMode,
                        disposalCatalogId,
                        page: 1,
                      }),
                    })
                  }}
                />
              )}
              {sortedFonds.length > 1 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                  {t('page.selectFondFirst')}
                </Card>
              ) : null}
            </section>
          ) : null}

          {showBrowseGrids && browseView === 'dossierTypes' ? (
            <section className="min-h-0 flex-1 space-y-2 overflow-auto">
              {sortedDossierTypes.length === 0 && !isDossierTypesPending ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  {t('page.dossierTypeListEmpty')}
                </Card>
              ) : (
                <ArchiveWarehouseCatalogGrid
                  items={sortedDossierTypes.map((item) => ({
                    id: item.id,
                    name: item.name,
                    description: t('page.catalogDossierCount', {
                      count: item.dossierCount ?? 0,
                    }),
                  }))}
                  emptyMessage={t('page.dossierTypeListEmpty')}
                  icon={FolderOpen}
                  onSelect={(dossierTypeId) => {
                    void navigateToFond({
                      to: '/app/archive-dossiers/by-dossier-type/$dossierTypeId',
                      params: { dossierTypeId },
                      search: buildWarehousePickerRouteSearch({
                        pickerMode,
                        disposalCatalogId,
                        page: 1,
                      }),
                    })
                  }}
                />
              )}
              {sortedDossierTypes.length > 1 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                  {t('page.selectDossierTypeFirst')}
                </Card>
              ) : null}
            </section>
          ) : null}

          {showBrowseGrids && browseView === 'documentTypes' ? (
            <section className="min-h-0 flex-1 space-y-2 overflow-auto">
              {sortedDocumentTypes.length === 0 && !isDocumentTypesPending ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  {t('page.documentTypeListEmpty')}
                </Card>
              ) : (
                <ArchiveWarehouseCatalogGrid
                  items={sortedDocumentTypes.map((item) => ({
                    id: item.id,
                    name: item.name,
                    description: t('page.catalogDocumentCount', {
                      count: item.documentCount ?? 0,
                    }),
                  }))}
                  emptyMessage={t('page.documentTypeListEmpty')}
                  icon={FileText}
                  onSelect={(documentTypeId) => {
                    void navigateToFond({
                      to: '/app/archive-dossiers/by-document-type/$documentTypeId',
                      params: { documentTypeId },
                      search: buildWarehousePickerRouteSearch({
                        pickerMode,
                        disposalCatalogId,
                        page: 1,
                      }),
                    })
                  }}
                />
              )}
              {sortedDocumentTypes.length > 1 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                  {t('page.selectDocumentTypeFirst')}
                </Card>
              ) : null}
            </section>
          ) : null}

          {showBrowseGrids && browseView === 'unassigned' ? (
            <ArchiveWarehouseUnassignedSection
              page={page}
              limit={limit}
              search={q}
              pickerMode={pickerMode}
              disposalCatalogId={disposalCatalogId}
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

      <SecurityAccessPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open)
          if (!open) {
            unlockMutation.reset()
            setPendingOpen(null)
          }
        }}
        title={tSecurity('access.dossierTitle')}
        description={tSecurity('access.dossierDescription')}
        errorMessage={
          unlockMutation.error
            ? translateError(unlockMutation.error) ||
              tSecurity('access.unlockFailed')
            : undefined
        }
        isPending={unlockMutation.isPending}
        onSubmit={async (password) => {
          await unlockMutation.mutateAsync(password)
        }}
      />
    </div>
  )
}
