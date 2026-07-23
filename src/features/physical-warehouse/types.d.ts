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
  capacity: number | null
  /** Direct child count when returned from list/tree APIs. */
  childCount?: number
  usedCapacity?: number
  /** True when this node is a storage unit (fixed bottom level). */
  isBottomLevel?: boolean
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
  /** Set to create a storage unit (fixed bottom). Omit/null for intermediate. */
  capacity?: number | null
}

export type UpdateItemPayloadT = {
  name?: string
  imageUrl?: string | null
  address?: string | null
  mapsUrl?: string | null
  capacity?: number | null
}
