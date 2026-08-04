export interface PhysicalWarehouseItemT {
  id: string
  parentId: string | null
  name: string
  /** Storage key or legacy external URL (as stored in DB). */
  imageUrl: string | null
  /** Presigned/display URL for <img src>. */
  imageDisplayUrl?: string | null
  address: string | null
  /** Google Maps link for this warehouse. */
  mapsUrl: string | null
  /**
   * Dual meaning based on isBottomLevel:
   * - isBottomLevel = true  → storage capacity (max placement units in this box).
   * - isBottomLevel = false → max number of direct children this level may hold.
   * null = unlimited.
   */
  capacity: number | null
  /** Direct child count when returned from list/tree APIs. */
  childCount?: number
  usedCapacity?: number
  /** Explicit discriminator: true = storage unit ("ô chứa", fixed bottom level, no children). Source of truth — never re-derive from capacity. */
  isBottomLevel: boolean
  remainingCapacity?: number | null
  createdAt: string
  updatedAt: string
}

export type PhysicalWarehouseUploadImageResultT = {
  storageKey: string
  imageUrl: string
  imageDisplayUrl: string | null
}

export interface PhysicalWarehouseTreeNodeT extends PhysicalWarehouseItemT {
  children: Array<PhysicalWarehouseTreeNodeT>
  childCount: number
  usedCapacity?: number
}

export interface PhysicalWarehouseLevelStatT {
  levelId: string
  levelName: string
  levelOrder: number
  count: number
}

export interface PhysicalWarehouseStatsT {
  locationCount: number
  levelStats: Array<PhysicalWarehouseLevelStatT>
  bottomLevelCount: number
  totalCapacity: number
  usedCapacity: number
  fillRate: number
  overloadedCount: number
}

export type CreateItemPayloadT = {
  parentId?: string | null
  name: string
  imageUrl?: string | null
  address?: string | null
  mapsUrl?: string | null
  /** true = create a storage unit ("ô chứa", fixed bottom level, no children). */
  isBottomLevel: boolean
  /**
   * isBottomLevel = true  → storage capacity for this box.
   * isBottomLevel = false → max number of direct children this level may hold. Omit/null = unlimited.
   */
  capacity?: number | null
}

export type UpdateItemPayloadT = {
  name?: string
  imageUrl?: string | null
  address?: string | null
  mapsUrl?: string | null
  /** Dual meaning — see PhysicalWarehouseItemT.capacity. isBottomLevel is immutable after creation. */
  capacity?: number | null
}