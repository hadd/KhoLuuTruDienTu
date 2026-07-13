export interface PhysicalWarehouseLevelT {
  id: string
  levelName: string
  levelOrder: number
  createdAt: string
  updatedAt: string
}

export interface PhysicalWarehouseItemT {
  id: string
  parentId: string | null
  levelId: string | null
  name: string
  imageUrl: string | null
  address: string | null
  capacity: number | null
  createdAt: string
  updatedAt: string
}

export interface PhysicalWarehouseTreeNodeT extends PhysicalWarehouseItemT {
  children: Array<PhysicalWarehouseTreeNodeT>
  childCount: number
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

export type ReplaceLevelsPayloadT = {
  levels: Array<{
    levelName: string
    levelOrder: number
  }>
}

export type CreateItemPayloadT = {
  parentId?: string | null
  levelId?: string | null
  name: string
  imageUrl?: string | null
  address?: string | null
  capacity?: number | null
}

export type UpdateItemPayloadT = {
  name?: string
  imageUrl?: string | null
  address?: string | null
  capacity?: number | null
}
