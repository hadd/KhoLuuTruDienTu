import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  buildWarehouseSearchApiParams,
  hasWarehouseFilterCriteria,
  type ArchiveWarehouseFilterValues,
} from '@/features/archive-warehouse/components/ArchiveWarehouseSearchFilters'
import { archiveWarehouseFondsQueryOptions } from '@/features/archive-warehouse/queries'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import {
  buildNavigateSearchFromPlacement,
  dedupePhysicalWarehouseSearchHits,
  isPhysicalWarehouseArchiveSearchActive,
} from '@/features/physical-warehouse/lib/physicalWarehouseSearchNav'
import { physicalWarehouseArchiveSearchQueryOptions } from '@/features/physical-warehouse/queries'
import type { PhysicalWarehouseSearchHitT } from '@/features/physical-warehouse/types'
import type { PhysicalWarehouseSearchT } from '@/features/physical-warehouse/schemas'

const routeApi = getRouteApi('/app/physical-warehouse/')
const SEARCH_PAGE_LIMIT = 20

type UsePhysicalWarehouseArchiveSearchPanelOptions = {
  onNavigateToPlacement: (patch: Partial<PhysicalWarehouseSearchT>) => void
  hideSearchResults?: boolean
  onRevealSearchResults?: () => void
}

export function usePhysicalWarehouseArchiveSearchPanel({
  onNavigateToPlacement,
  hideSearchResults = false,
  onRevealSearchResults,
}: UsePhysicalWarehouseArchiveSearchPanelOptions) {
  const { t } = useTranslation('physical-warehouse')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { canReadArchiveWarehouse } = useArchiveWarehouseAccess()

  const [inputValue, setInputValue] = useState(search.q ?? '')

  const isSearchActive = isPhysicalWarehouseArchiveSearchActive(search)
  const page = search.page ?? 1

  const filterValues = useMemo(
    () => ({
      q: search.q,
      searchFondId: search.searchFondId,
      dossierTypeId: search.dossierTypeId,
      documentTypeId: search.documentTypeId,
      searchFields: search.searchFields,
      editorName: search.editorName,
      editCompletedAtFrom: search.editCompletedAtFrom,
      editCompletedAtTo: search.editCompletedAtTo,
      archivedAtFrom: search.archivedAtFrom,
      archivedAtTo: search.archivedAtTo,
    }),
    [search],
  )

  const searchParams = useMemo(() => {
    if (!isSearchActive) return null
    return buildWarehouseSearchApiParams(filterValues, {
      page,
      limit: SEARCH_PAGE_LIMIT,
    })
  }, [filterValues, isSearchActive, page])

  const { data: fondsData } = useQuery({
    ...archiveWarehouseFondsQueryOptions(),
    enabled: canReadArchiveWarehouse,
  })
  const fonds = fondsData?.items ?? []

  const { data: searchData, isFetching: searchLoading } = useQuery({
    ...physicalWarehouseArchiveSearchQueryOptions(searchParams),
    enabled: canReadArchiveWarehouse && searchParams != null,
  })

  const searchItems = useMemo(
    () => dedupePhysicalWarehouseSearchHits(searchData?.items ?? []),
    [searchData?.items],
  )

  const showSearchResults = isSearchActive && !hideSearchResults
  const showApplyHint =
    hasWarehouseFilterCriteria(filterValues) && !hideSearchResults && !isSearchActive

  function submitSearch() {
    onRevealSearchResults?.()
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
    onRevealSearchResults?.()
    setInputValue('')
    void navigate({
      search: (prev) => ({
        rootId: prev.rootId,
        warehouseId: prev.warehouseId,
        parentId: prev.parentId,
        tab: prev.tab,
        focusDossierId: undefined,
        page: 1,
        limit: prev.limit,
      }),
      replace: true,
    })
  }

  function applyFilterPatch(patch: Partial<ArchiveWarehouseFilterValues>) {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        q: patch && 'q' in patch ? patch.q : inputValue.trim() || prev.q,
        page: 1,
      }),
      replace: true,
    })
  }

  function handleSelectSearchHit(hit: PhysicalWarehouseSearchHitT) {
    const placement = hit.physicalPlacement
    if (!placement || placement.ancestorIds.length < 2) {
      toast.message(t('search.noPhysicalPlacementToast'))
      return
    }
    const navPatch = buildNavigateSearchFromPlacement({
      physicalItemId: placement.physicalItemId,
      ancestorIds: placement.ancestorIds,
      dossierId: hit.entityId,
      dossierTitle: hit.title,
      placementBreadcrumb: placement.breadcrumb,
    })
    if (!navPatch) {
      toast.message(t('search.noPhysicalPlacementToast'))
      return
    }
    onNavigateToPlacement({
      ...navPatch,
      q: search.q,
      page: search.page,
      limit: search.limit,
      mode: search.mode,
      searchFondId: search.searchFondId,
      dossierTypeId: search.dossierTypeId,
      documentTypeId: search.documentTypeId,
      searchFields: search.searchFields,
      editorName: search.editorName,
      editCompletedAtFrom: search.editCompletedAtFrom,
      editCompletedAtTo: search.editCompletedAtTo,
      archivedAtFrom: search.archivedAtFrom,
      archivedAtTo: search.archivedAtTo,
    })
  }

  return {
    canReadArchiveWarehouse,
    inputValue,
    setInputValue,
    filterValues,
    fonds,
    searchItems,
    searchLoading,
    searchData,
    searchParams,
    showSearchResults,
    showApplyHint,
    submitSearch,
    clearFilters,
    applyFilterPatch,
    handleSelectSearchHit,
    searchPlaceholder: t('search.placeholder'),
    applyHint: t('search.applyHint'),
  }
}
