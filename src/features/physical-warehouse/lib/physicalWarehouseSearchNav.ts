import type { PhysicalWarehouseSearchT } from '@/features/physical-warehouse/schemas'

import type { PhysicalWarehouseSearchHitT } from '@/features/physical-warehouse/types'

/** Khớp logic backend `physical-warehouse-search-dedupe.ts`. */
export function physicalWarehouseSearchResultKey(
  hit: PhysicalWarehouseSearchHitT,
): string {
  const physicalItemId = hit.physicalPlacement?.physicalItemId
  if (physicalItemId) {
    const title = hit.title.trim().toLowerCase()
    const fond = hit.fondId ?? ''
    return `placed:${physicalItemId}:${title}:${fond}`
  }
  return `entity:${hit.entityId}`
}

/** Gộp hit trùng sau enrich vị trí (backend cũng dedupe; FE phòng hờ). */
export function dedupePhysicalWarehouseSearchHits(
  items: Array<PhysicalWarehouseSearchHitT>,
): Array<PhysicalWarehouseSearchHitT> {
  const byKey = new Map<string, PhysicalWarehouseSearchHitT>()
  for (const item of items) {
    const key = physicalWarehouseSearchResultKey(item)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, item)
      continue
    }
    const keepCurrent = (item.score ?? 0) > (existing.score ?? 0)
    const primary = keepCurrent ? item : existing
    const secondary = keepCurrent ? existing : item
    byKey.set(key, {
      ...primary,
      matches: [...(secondary.matches ?? []), ...(primary.matches ?? [])],
    })
  }
  return [...byKey.values()]
}

export type PhysicalWarehousePlacementNavInput = {
  physicalItemId: string
  ancestorIds: Array<string>
  dossierId: string
  dossierTitle?: string
  placementBreadcrumb?: string
}

/** Maps placement path to route search params used by PhysicalWarehousePage. */
export function buildNavigateSearchFromPlacement(
  input: PhysicalWarehousePlacementNavInput,
): Partial<PhysicalWarehouseSearchT> | null {
  const {
    ancestorIds,
    physicalItemId,
    dossierId,
    dossierTitle,
    placementBreadcrumb,
  } = input
  if (ancestorIds.length < 2) return null

  return {
    rootId: ancestorIds[0],
    warehouseId: ancestorIds[1],
    parentId: physicalItemId,
    tab: 'diagram',
    highlightPhysicalItemId: physicalItemId,
    focusDossierId: dossierId,
    focusDossierTitle: dossierTitle?.trim() || undefined,
    focusPlacementPath: placementBreadcrumb?.trim() || undefined,
  }
}

export function isPhysicalWarehouseArchiveSearchActive(
  search: PhysicalWarehouseSearchT,
): boolean {
  const q = search.q?.trim()
  if (q) return true
  return Boolean(
    search.dossierTypeId ||
      search.documentTypeId ||
      search.searchFields ||
      search.editorName?.trim() ||
      search.editCompletedAtFrom ||
      search.editCompletedAtTo ||
      search.archivedAtFrom ||
      search.archivedAtTo ||
      search.searchFondId,
  )
}
