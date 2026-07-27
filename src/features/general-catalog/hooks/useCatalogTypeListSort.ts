import type { CatalogSortDirectionT, CatalogTypeSortFieldT } from '@/features/general-catalog/lib/catalogListSort'
import { toggleCatalogListSort } from '@/features/general-catalog/lib/catalogListSort'

type CatalogTypeListSortSearch = {
  sortBy?: CatalogTypeSortFieldT
  sortDir?: CatalogSortDirectionT
  page?: number
}

type CatalogListNavigate = (options: {
  search: (prev: CatalogTypeListSortSearch) => CatalogTypeListSortSearch
  replace?: boolean
}) => void | Promise<void>

export function useCatalogTypeListSort(
  search: CatalogTypeListSortSearch,
  navigate: CatalogListNavigate,
) {
  function handleSortChange(field: CatalogTypeSortFieldT) {
    const next = toggleCatalogListSort(search, field)
    void navigate({
      search: (prev) => ({
        ...prev,
        ...next,
        page: 1,
      }),
      replace: true,
    })
  }

  return {
    sortBy: search.sortBy,
    sortDir: search.sortDir,
    handleSortChange,
  }
}
