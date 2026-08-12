import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { BookOpenCheck, Download, Loader2, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ArchiveBorrowCreateDialog } from '@/features/archive-borrow/components/ArchiveBorrowCreateDialog'
import { useArchiveBorrowAccess } from '@/features/archive-borrow/hooks/useArchiveBorrowAccess'
import { transferToDisposalProposal } from '@/features/archive-disposal/api/archiveDisposalClient'
import {
  isAppendToDisposalCatalog,
  notifyDisposalTransferResult,
} from '@/features/archive-disposal/lib/disposalTransferNotifications'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import {
  shouldShowWarehousePickerSelection,
  shouldShowWarehouseRowSelection,
} from '@/features/archive-disposal/lib/warehousePickerSelection'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import { disposalSettingsQueryOptions } from '@/features/archive-disposal-council/queries'
import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  stickyTableHeaderClassName,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArchiveWarehouseDataShell } from '@/features/archive-warehouse/components/ArchiveWarehouseDataShell'
import { ArchiveWarehouseExportDialog } from '@/features/archive-warehouse/components/ArchiveWarehouseExportDialog'
import {
  ArchiveWarehouseSearchFilters,
  buildWarehouseSearchApiParams,
  hasWarehouseFilterCriteria,
} from '@/features/archive-warehouse/components/ArchiveWarehouseSearchFilters'
import { ArchiveWarehouseSearchResults } from '@/features/archive-warehouse/components/ArchiveWarehouseSearchResults'
import { ArchiveWarehouseStatCards } from '@/features/archive-warehouse/components/ArchiveWarehouseStatCards'
import { buildArchiveDossierDetailSearch } from '@/features/archive-warehouse/lib/archiveDossierDetailNavigation'
import { canExportDossiers } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { isUnassignedWarehouseFondId } from '@/features/archive-warehouse/lib/unassignedFond'
import {
  archiveWarehouseDossierDetailQueryOptions,
  archiveWarehouseDossiersQueryOptions,
  archiveWarehouseFondSummaryQueryOptions,
  archiveWarehouseSearchQueryOptions,
  archiveWarehouseUnassignedDossiersQueryOptions,
} from '@/features/archive-warehouse/queries'
import {
  libraryExploitationDossierDetailQueryOptions,
  libraryExploitationDossiersQueryOptions,
  libraryExploitationFondSummaryQueryOptions,
  libraryExploitationSearchQueryOptions,
  libraryExploitationUnassignedDossiersQueryOptions,
} from '@/features/library/api/exploitation-queries'
import { LibraryPageShell } from '@/features/library/components/LibraryPageShell'
import type { ArchiveWarehouseFondDossiersSearchT } from '@/features/archive-warehouse/schemas'
import type { WarehouseDossierStatusT } from '@/features/archive-warehouse/types'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import { verifyDossierAccess } from '@/features/security-level/api/securityLevelClient'
import { SecurityAccessPasswordDialog } from '@/features/security-level/components/SecurityAccessPasswordDialog'
import { getPasswordRequiredFromError } from '@/features/security-level/lib/passwordRequired'
import {
  rememberDossierSecurityLevel,
  setDossierAccessToken,
  type SecurityAccessModule,
} from '@/features/security-level/lib/securityAccessTokenStore'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

type DossierOpenMatchT = {
  fileName?: string | null
  page?: number | null
  bbox?: Array<number> | null
}

type PendingDossierOpenT = {
  dossierId: string
  securityLevelId?: string | null
  match?: DossierOpenMatchT
}

const defaultRouteApi = getRouteApi('/app/archive-dossiers/$fondId/')

const DEFAULT_STATUS: WarehouseDossierStatusT = 'ARCHIVED'

type DateLocale = 'en' | 'vi'

function toDateLocale(lang: string): DateLocale {
  return lang.startsWith('vi') ? 'vi' : 'en'
}

export interface ArchiveWarehouseDossiersPageProps {
  browseMode?: 'warehouse' | 'exploitation'
  routeApi?: any
  viewMode?: 'fond' | 'dossierType' | 'documentType'
}

export function ArchiveWarehouseDossiersPage({
  browseMode = 'warehouse',
  routeApi: propRouteApi,
  viewMode: _viewMode = 'fond',
}: ArchiveWarehouseDossiersPageProps = {}) {
  const activeRouteApi = propRouteApi ?? defaultRouteApi
  const isExploitation = browseMode === 'exploitation'
  const accessModule: SecurityAccessModule = isExploitation
    ? 'exploitation'
    : 'warehouse'
  const { t, i18n } = useTranslation('archive-warehouse')
  const { t: tDisposal } = useTranslation('archive-disposal')
  const { t: tSecurity } = useTranslation('security-level')
  const { t: tBorrow } = useTranslation('archive-borrow')
  const queryClient = useQueryClient()
  const { fondId } = activeRouteApi.useParams()
  const isUnassigned = isUnassignedWarehouseFondId(fondId)
  const search =
    activeRouteApi.useSearch() as unknown as ArchiveWarehouseFondDossiersSearchT
  const navigate = activeRouteApi.useNavigate()
  const dateLocale = toDateLocale(i18n.language)

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
  const [borrowDialogOpen, setBorrowDialogOpen] = useState(false)
  const [openingDossierId, setOpeningDossierId] = useState<string | null>(null)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [pendingOpen, setPendingOpen] = useState<PendingDossierOpenT | null>(
    null,
  )

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
  const { canUpdateDisposal } = useArchiveDisposalAccess()
  const { canReadDisposalSettings } = useDisposalCouncilAccess()
  const { data: disposalSettings } = useQuery({
    ...disposalSettingsQueryOptions(),
    enabled: canReadDisposalSettings,
  })
  const councilReviewEnabled = canReadDisposalSettings
    ? (disposalSettings?.councilReviewEnabled ?? true)
    : true

  const pickerTransferMutation = useMutation({
    mutationFn: transferToDisposalProposal,
    onSuccess: (result, variables) => {
      notifyDisposalTransferResult(result, {
        appendToCatalog: isAppendToDisposalCatalog(variables.catalogId),
        t: tDisposal,
      })
      setSelectedIds(new Set())
      void navigate({
        to: '/app/archive-warehouse',
        search: {
          tab: 'expiryReview',
          disposalView: 'proposal',
          disposalCatalogId,
          page: 1,
        },
      })
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })

  const filterValues = {
    q,
    dossierTypeId: search.dossierTypeId,
    documentTypeId: search.documentTypeId,
    searchFields: search.searchFields,
    editorName: search.editorName,
    editCompletedAtFrom: search.editCompletedAtFrom,
    editCompletedAtTo: search.editCompletedAtTo,
    archivedAtFrom: search.archivedAtFrom,
    archivedAtTo: search.archivedAtTo,
  }

  const isEsSearchActive =
    !isUnassigned && hasWarehouseFilterCriteria(filterValues)

  const { canRequestBorrow } = useArchiveBorrowAccess()
  const showBorrowSelection = isExploitation && canRequestBorrow
  const showDownload = isExploitation ? false : canExportDossiers(permissions) && !pickerMode
  const showPickerSelection = isExploitation ? false : shouldShowWarehousePickerSelection({
    pickerMode,
    councilReviewEnabled,
    canUpdateDisposal,
    disposalCatalogId,
    isEsSearchActive,
  })
  const showRowSelection =
    shouldShowWarehouseRowSelection({
      showDownload,
      showPickerSelection,
    }) || showBorrowSelection

  const listParams = {
    fondId,
    page,
    limit,
    search: !isEsSearchActive && q ? q : undefined,
    year,
    status,
  }

  const summaryParams = isUnassigned ? null : { fondId, status }
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
  } = useQuery(
    isExploitation
      ? libraryExploitationFondSummaryQueryOptions(summaryParams)
      : archiveWarehouseFondSummaryQueryOptions(summaryParams),
  )

  const {
    data: unassignedData,
    isPending: isUnassignedPending,
    isFetching: isUnassignedFetching,
    isError: isUnassignedListError,
    error: unassignedListError,
  } = useQuery({
    ...(isExploitation
      ? libraryExploitationUnassignedDossiersQueryOptions({
          page,
          limit,
          search: q || undefined,
          status,
        })
      : archiveWarehouseUnassignedDossiersQueryOptions({
          page,
          limit,
          search: q || undefined,
          status,
        })),
    enabled: isUnassigned && !isEsSearchActive,
  })

  const {
    data,
    isPending,
    isFetching,
    isError: isListError,
    error: listError,
  } = useQuery({
    ...(isExploitation
      ? libraryExploitationDossiersQueryOptions(listParams)
      : archiveWarehouseDossiersQueryOptions(listParams)),
    enabled: !isUnassigned && !isEsSearchActive,
  })

  const {
    data: searchData,
    isPending: isSearchPending,
    isFetching: isSearchFetching,
    isError: isSearchError,
    error: searchError,
  } = useQuery(
    isExploitation
      ? libraryExploitationSearchQueryOptions(searchParams)
      : archiveWarehouseSearchQueryOptions(searchParams),
  )

  const items = isUnassigned
    ? (unassignedData?.items ?? [])
    : isEsSearchActive
      ? []
      : (data?.items ?? [])
  const searchItems = isEsSearchActive ? (searchData?.items ?? []) : []
  const totalPages = Math.max(
    1,
    isEsSearchActive
      ? Math.ceil((searchData?.total ?? 0) / limit) || 1
      : isUnassigned
        ? (unassignedData?.totalPages ?? 1)
        : (data?.totalPages ?? 1),
  )
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const hasActiveFilters = Boolean(q) || year != null || isEsSearchActive
  const listLoading = isEsSearchActive
    ? isSearchPending || isSearchFetching
    : isUnassigned
      ? isUnassignedPending || isUnassignedFetching
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
    const hasData = isEsSearchActive
      ? Boolean(searchData)
      : isUnassigned
        ? Boolean(unassignedData)
        : Boolean(data)
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
    unassignedData,
    searchData,
    isEsSearchActive,
    isUnassigned,
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
        status:
          patch.status ??
          (prev as ArchiveWarehouseFondDossiersSearchT).status ??
          DEFAULT_STATUS,
        page: 1,
      }),
      replace: true,
    })
  }

  function navigateToDossierDetail(
    dossierId: string,
    match?: DossierOpenMatchT,
  ) {
    const highlightBbox =
      match?.bbox && match.bbox.length >= 4
        ? match.bbox.slice(0, 4).join(',')
        : undefined

    void navigate({
      to: (isExploitation
        ? '/app/library/exploitation/$fondId/$dossierId'
        : '/app/archive-dossiers/$fondId/$dossierId') as any,
      params: { fondId, dossierId },
      search: buildArchiveDossierDetailSearch(
        {
          browseView: isUnassigned ? 'unassigned' : 'fonds',
        },
        {
          fileName: match?.fileName ?? undefined,
          highlightPage: match?.page && match.page > 0 ? match.page : undefined,
          highlightBbox,
        },
      ),
    })
  }

  async function openDossierDetail(
    dossierId: string,
    match?: DossierOpenMatchT,
    securityLevelId?: string | null,
  ) {
    if (openingDossierId || passwordDialogOpen) return

    if (securityLevelId) {
      rememberDossierSecurityLevel(accessModule, dossierId, securityLevelId)
    }

    setOpeningDossierId(dossierId)
    try {
      await queryClient.fetchQuery(
        isExploitation
          ? libraryExploitationDossierDetailQueryOptions(dossierId)
          : archiveWarehouseDossierDetailQueryOptions(dossierId, securityLevelId),
      )
      navigateToDossierDetail(dossierId, match)
    } catch (err) {
      const passwordRequired = getPasswordRequiredFromError(err)
      if (passwordRequired?.scope === 'dossier') {
        setPendingOpen({ dossierId, securityLevelId, match })
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
      const { dossierId, securityLevelId, match } = pendingOpen
      setDossierAccessToken(accessModule, dossierId, result.token, result.expiresIn)
      setPasswordDialogOpen(false)
      toast.success(tSecurity('access.unlockSuccess'))
      try {
        await queryClient.fetchQuery(
          isExploitation
            ? libraryExploitationDossierDetailQueryOptions(dossierId)
            : archiveWarehouseDossierDetailQueryOptions(dossierId, securityLevelId),
        )
        setPendingOpen(null)
        navigateToDossierDetail(dossierId, match)
      } catch (err) {
        toast.error(translateError(err) || tSecurity('access.unlockFailed'))
      }
    },
    onError: (err) => {
      toast.error(translateError(err) || tSecurity('access.unlockFailed'))
    },
  })

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
    isSummaryError || isListError || isSearchError || isUnassignedListError
      ? translateError(
          (summaryError ??
            listError ??
            searchError ??
            unassignedListError) instanceof Error
            ? (summaryError ?? listError ?? searchError ?? unassignedListError)
            : new Error(t('errors.fondForbidden')),
        )
      : null

  const pageContent = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 space-y-3 overflow-visible">
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
          <div className="flex flex-col gap-3">
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
                isExploitation ? (
                  canRequestBorrow ? (
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
                        onClick={() => setBorrowDialogOpen(true)}
                      >
                        <BookOpenCheck className="mr-2 size-4" aria-hidden />
                        {tBorrow('page.submitRequest')}
                      </Button>
                    </>
                  ) : undefined
                ) : showPickerSelection ? (
                  <Button
                    type="button"
                    disabled={
                      !hasSelection ||
                      pickerTransferMutation.isPending ||
                      !disposalCatalogId
                    }
                    onClick={() => {
                      if (!disposalCatalogId) return
                      pickerTransferMutation.mutate({
                        catalogId: disposalCatalogId,
                        items: selectedDossierIds.map((dossierId) => ({
                          dossierId,
                          source: 'WAREHOUSE' as const,
                        })),
                      })
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
                ) : !isEsSearchActive && items.length > 0 && showDownload ? (
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
          </div>
        ) : null}
        </div>

        {!forbiddenMessage ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            {listLoading && items.length === 0 && searchItems.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : null}

            {!listLoading &&
            !isEsSearchActive &&
            !isUnassigned &&
            summaryData?.dossierCount === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                {t('page.fondEmpty')}
              </Card>
            ) : null}

            {!listLoading &&
            !isEsSearchActive &&
            !isUnassigned &&
            summaryData &&
            summaryData.dossierCount > 0 &&
            items.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                {hasActiveFilters ? t('page.noMatch') : t('page.fondEmpty')}
              </Card>
            ) : null}

            {!listLoading && isUnassigned && items.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                {hasActiveFilters
                  ? t('page.noMatch')
                  : t('page.unassignedDossiersEmpty')}
              </Card>
            ) : null}

            {isEsSearchActive ? (
              <div className="min-h-0 flex-1 overflow-auto">
                <ArchiveWarehouseSearchResults
                  items={searchItems}
                  isLoading={listLoading}
                  tookMs={searchData?.took_ms}
                  message={searchData?.message}
                  mode={searchParams?.mode}
                  onSelect={(hit, match) => {
                    void openDossierDetail(hit.entityId, match)
                  }}
                />
              </div>
            ) : null}

          {!isEsSearchActive && items.length > 0 ? (
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
                    <TableHead>{t('table.physicalLocation')}</TableHead>
                    <TableHead>{t('table.documentCount')}</TableHead>
                    <TableHead>{t('table.archivedAt')}</TableHead>
                    <TableHead>{t('table.path')}</TableHead>
                    <TableHead>{t('table.dossierType')}</TableHead>
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
                          : () => {
                              void openDossierDetail(
                                item.id,
                                undefined,
                                item.securityLevelId,
                              )
                            }
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
                      <TableCell className="truncate">
                        {item.dossierTypeName ?? '—'}
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
                      search: (prev) => ({
                        ...prev,
                        limit: nextLimit,
                        page: 1,
                      }),
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
          )}
          onExported={() => setSelectedIds(new Set())}
        />

        <ArchiveBorrowCreateDialog
          open={borrowDialogOpen}
          onOpenChange={setBorrowDialogOpen}
          onCreated={() => setSelectedIds(new Set())}
          initialItems={selectedDossierIds.map((id) => {
            const found = items.find((it) => it.id === id)
            return {
              id,
              name: found?.name ?? id,
            }
          })}
        />

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

  if (isExploitation) {
    return <LibraryPageShell activeTab="exploitation">{pageContent}</LibraryPageShell>
  }

  return <ArchiveWarehouseDataShell>{pageContent}</ArchiveWarehouseDataShell>
}
