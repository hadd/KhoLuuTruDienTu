export const WAREHOUSE_DOSSIER_BROWSE_SORT_FIELDS = [
  'fondName',
  'dossierTypeName',
] as const

export type WarehouseDossierBrowseSortFieldT =
  (typeof WAREHOUSE_DOSSIER_BROWSE_SORT_FIELDS)[number]

export type WarehouseBrowseSortDirectionT = 'asc' | 'desc'

export function toggleWarehouseBrowseSort(
  current: {
    sortBy?: WarehouseDossierBrowseSortFieldT
    sortDir?: WarehouseBrowseSortDirectionT
  },
  field: WarehouseDossierBrowseSortFieldT,
): {
  sortBy: WarehouseDossierBrowseSortFieldT
  sortDir: WarehouseBrowseSortDirectionT
} {
  if (current.sortBy !== field) {
    return { sortBy: field, sortDir: 'asc' }
  }
  return {
    sortBy: field,
    sortDir: current.sortDir === 'asc' ? 'desc' : 'asc',
  }
}
