export const CATALOG_TYPE_SORT_FIELDS = ['id', 'isActive'] as const

export type CatalogTypeSortFieldT = (typeof CATALOG_TYPE_SORT_FIELDS)[number]
export type CatalogSortDirectionT = 'asc' | 'desc'

export function buildCatalogListSortParam(
  sortBy?: CatalogTypeSortFieldT,
  sortDir?: CatalogSortDirectionT,
): string | undefined {
  if (!sortBy) return undefined
  return `${sortBy}:${sortDir ?? 'asc'}`
}

export function toggleCatalogListSort(
  current: {
    sortBy?: CatalogTypeSortFieldT
    sortDir?: CatalogSortDirectionT
  },
  field: CatalogTypeSortFieldT,
): {
  sortBy: CatalogTypeSortFieldT
  sortDir: CatalogSortDirectionT
} {
  if (current.sortBy !== field) {
    return { sortBy: field, sortDir: 'asc' }
  }
  return {
    sortBy: field,
    sortDir: current.sortDir === 'asc' ? 'desc' : 'asc',
  }
}
