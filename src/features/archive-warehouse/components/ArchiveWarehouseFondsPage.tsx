import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Loader2, Plus, FileText, FolderOpen, Trash2 } from 'lucide-react'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { ArchiveWarehouseDropdownFilterTableHead } from '@/features/archive-warehouse/components/ArchiveWarehouseDropdownFilterTableHead'
import { ArchiveWarehouseSearchResults } from '@/features/archive-warehouse/components/ArchiveWarehouseSearchResults'
import { buildArchiveDossierDetailSearch } from '@/features/archive-warehouse/lib/archiveDossierDetailNavigation'
import {
  readManageByFondPreference,
  writeManageByFondPreference,
} from '@/features/archive-warehouse/lib/manageByFondPreference'
import { UNASSIGNED_WAREHOUSE_FOND_ID } from '@/features/archive-warehouse/lib/unassignedFond'
import { softDeleteWarehouseDossier } from '@/features/archive-warehouse/api/archiveWarehouseClient'
import { SOFT_DELETED_DOSSIERS_QUERY_KEY } from '@/features/archive-disposal/components/ArchiveSoftDeletedDossiersPage'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import { disposalSettingsQueryOptions } from '@/features/archive-disposal-council/queries'
import { profileQueryOptions } from '@/features/auth/queries'
import {
  archiveWarehouseDossierDetailQueryOptions,
  archiveWarehouseDossiersQueryOptions,
  archiveWarehouseDossierTypesQueryOptions,
  archiveWarehouseDocumentTypesQueryOptions,
  archiveWarehouseFondsQueryOptions,
  archiveWarehouseSearchQueryOptions,
} from '@/features/archive-warehouse/queries'
import { canDeleteArchiveWarehouse } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
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
  councilReviewEnabledProp?: boolean
}

export function ArchiveWarehouseFondsPage({
  embedded: _embedded = false,
  councilReviewEnabledProp,
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
  const { canFetchDisposalSettings } = useDisposalCouncilAccess()
  const { data: disposalSettings } = useQuery({
    ...disposalSettingsQueryOptions(),
    enabled: canFetchDisposalSettings,
  })
  const councilReviewEnabled = canFetchDisposalSettings
    ? (disposalSettings?.councilReviewEnabled ?? true)
    : false
  // canDelete: show delete when TT06 is off, using prop from parent if embedded (avoids double-fetch)
  const effectiveCouncilReviewEnabled =
    councilReviewEnabledProp !== undefined
      ? councilReviewEnabledProp
      : councilReviewEnabled
  const canDelete = !effectiveCouncilReviewEnabled

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
  const [deletingDossierIds, setDeletingDossierIds] = useState<string[]>([])

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

  const { data: dossierTypesData, isPending: isDossierTypesPending } = useQuery(
    archiveWarehouseDossierTypesQueryOptions()
  )
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
      sortedFonds.length === 0 ||
      !sortedFonds[0]
    ) {
      return
    }
    // We purposefully removed the auto-navigate on length === 1
    // to allow users to see the toggle and grid even with a single fond.
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
    showRowSelection: hookShowRowSelection,
    pickerTransferMutation,
    transferItems,
  } = useWarehouseDisposalPicker({
    pickerMode,
    disposalCatalogId,
    isEsSearchActive,
    onTransferSuccess: () => setSelectedIds(new Set()),
  })
  const showRowSelection = hookShowRowSelection || canDelete

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

  function handleTableFilterChange(patch: Partial<typeof filterValues>) {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        page: 1,
      }),
      replace: true,
    })
  }

  const searchParams = isEsSearchActive
    ? buildWarehouseSearchApiParams(filterValues, { page, limit })
    : null

  const softDeleteDossierMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await softDeleteWarehouseDossier(id)
      }
    },
    onSuccess: () => {
      toast.success(deletingDossierIds.length > 1 ? 'Đã xóa các hồ sơ đã chọn.' : 'Đã xóa hồ sơ.')
      setDeletingDossierIds([])
      setSelectedIds(new Set())
      void queryClient.invalidateQueries({ queryKey: SOFT_DELETED_DOSSIERS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['archiveWarehouseDossiers'] })
      void queryClient.invalidateQueries({ queryKey: ['archiveWarehouseUnassignedDossiers'] })
    },
    onError: (error) => {
      toast.error(translateError(error))
      setDeletingDossierIds([])
    },
  })

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
                {canDelete && !manageByFond ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!hasSelection || softDeleteDossierMutation.isPending}
                    onClick={() => {
                      setDeletingDossierIds(selectedDossierIds)
                    }}
                  >
                    <Trash2 className="mr-2 size-4" aria-hidden />
                    {t('action.delete', 'Xóa')}
                  </Button>
                ) : null}
                {showPickerSelection && !manageByFond ? (
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
                    <ArchiveWarehouseSortableTableHead
                      label={t('table.name')}
                      field="name"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSortChange={handleBrowseSortChange}
                    />
                    <ArchiveWarehouseSortableTableHead
                      label={t('table.fond')}
                      field="fondName"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSortChange={handleBrowseSortChange}
                    />
                    <TableHead>{t('table.physicalLocation')}</TableHead>
                    <TableHead>{t('table.documentCount')}</TableHead>
                    <ArchiveWarehouseSortableTableHead
                      label={t('table.archivedAt')}
                      field="archivedAt"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSortChange={handleBrowseSortChange}
                    />
                    <ArchiveWarehouseSortableTableHead
                      label={t('table.dossierType')}
                      field="dossierTypeName"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSortChange={handleBrowseSortChange}
                    />
                    <TableHead>{t('table.archiveStorageState')}</TableHead>
                    {canDelete ? (
                      <TableHead className="w-16" />
                    ) : null}
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
                      {canDelete ? (
                        <TableCell
                          className="w-16 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:bg-destructive/10"
                            title="Xóa hồ sơ"
                            onClick={() => {
                              setDeletingDossierIds([item.id])
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      ) : null}
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

      <AlertDialog
        open={deletingDossierIds.length > 0}
        onOpenChange={(open) => { if (!open) setDeletingDossierIds([]) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa hồ sơ</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa <strong>{deletingDossierIds.length > 1 ? `${deletingDossierIds.length} hồ sơ đã chọn` : 'hồ sơ này'}</strong>? Hồ sơ sẽ được
              chuyển vào danh sách hồ sơ đã xóa và có thể xóa vĩnh viễn sau.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={softDeleteDossierMutation.isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deletingDossierIds.length > 0) softDeleteDossierMutation.mutate(deletingDossierIds) }}
              disabled={softDeleteDossierMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {softDeleteDossierMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Xóa hồ sơ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
