import { createContext, useContext, type ReactNode } from 'react'

import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { ArchiveWarehouseSearchFilters } from '@/features/archive-warehouse/components/ArchiveWarehouseSearchFilters'
import { PhysicalWarehouseSearchResults } from '@/features/physical-warehouse/components/PhysicalWarehouseSearchResults'
import { usePhysicalWarehouseArchiveSearchPanel } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseArchiveSearchPanel'
import type { PhysicalWarehouseSearchT } from '@/features/physical-warehouse/schemas'

type PhysicalWarehouseArchiveSearchContextValue = ReturnType<
  typeof usePhysicalWarehouseArchiveSearchPanel
>

const PhysicalWarehouseArchiveSearchContext =
  createContext<PhysicalWarehouseArchiveSearchContextValue | null>(null)

type PhysicalWarehouseArchiveSearchProviderProps = {
  onNavigateToPlacement: (patch: Partial<PhysicalWarehouseSearchT>) => void
  hideSearchResults?: boolean
  onRevealSearchResults?: () => void
  children: ReactNode
}

export function PhysicalWarehouseArchiveSearchProvider({
  onNavigateToPlacement,
  hideSearchResults = false,
  onRevealSearchResults,
  children,
}: PhysicalWarehouseArchiveSearchProviderProps) {
  const value = usePhysicalWarehouseArchiveSearchPanel({
    onNavigateToPlacement,
    hideSearchResults,
    onRevealSearchResults,
  })

  return (
    <PhysicalWarehouseArchiveSearchContext.Provider value={value}>
      {children}
    </PhysicalWarehouseArchiveSearchContext.Provider>
  )
}

function usePhysicalWarehouseArchiveSearchContext() {
  return useContext(PhysicalWarehouseArchiveSearchContext)
}

export function PhysicalWarehouseArchiveSearchFiltersBar() {
  const search = usePhysicalWarehouseArchiveSearchContext()
  if (!search?.canReadArchiveWarehouse) {
    return null
  }

  return (
    <div className="shrink-0 border-b border-border pb-3">
      <ArchiveWarehouseSearchFilters
        layout="compact"
        values={search.filterValues}
        searchInput={search.inputValue}
        onSearchInputChange={search.setInputValue}
        onSubmitSearch={search.submitSearch}
        searchPlaceholder={search.searchPlaceholder}
        fonds={search.fonds}
        leading={
          <ListPageSearchInput
            className="w-96"
            value={search.inputValue}
            onChange={search.setInputValue}
            onSearch={search.submitSearch}
            placeholder={search.searchPlaceholder}
          />
        }
        onChange={search.applyFilterPatch}
        onClear={search.clearFilters}
      />
    </div>
  )
}

export function PhysicalWarehouseArchiveSearchResultsBlock() {
  const search = usePhysicalWarehouseArchiveSearchContext()
  if (!search?.canReadArchiveWarehouse) {
    return null
  }

  if (search.showSearchResults) {
    return (
      <div className="shrink-0">
        <PhysicalWarehouseSearchResults
          items={search.searchItems}
          isLoading={search.searchLoading}
          tookMs={search.searchData?.took_ms}
          message={search.searchData?.message}
          mode={search.searchParams?.mode}
          searchFields={search.filterValues.searchFields}
          searchQuery={search.filterValues.q}
          onSelect={search.handleSelectSearchHit}
        />
      </div>
    )
  }

  if (search.showApplyHint) {
    return (
      <p className="shrink-0 text-xs text-muted-foreground">{search.applyHint}</p>
    )
  }

  return null
}

type PhysicalWarehouseArchiveSearchPanelProps = {
  onNavigateToPlacement: (patch: Partial<PhysicalWarehouseSearchT>) => void
  hideSearchResults?: boolean
  onRevealSearchResults?: () => void
}

/** Legacy single-block layout (search results inline above main content). */
export function PhysicalWarehouseArchiveSearchPanel(
  props: PhysicalWarehouseArchiveSearchPanelProps,
) {
  return (
    <PhysicalWarehouseArchiveSearchProvider {...props}>
      <div className="flex shrink-0 flex-col gap-3 border-b border-border pb-3">
        <PhysicalWarehouseArchiveSearchFiltersBar />
        <PhysicalWarehouseArchiveSearchResultsBlock />
      </div>
    </PhysicalWarehouseArchiveSearchProvider>
  )
}

export { usePhysicalWarehouseArchiveSearchPanel }
