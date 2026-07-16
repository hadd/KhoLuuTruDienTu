export interface InventoryT {
  id: string
  number: string
  name: string
  fondId: string
  submissionYear: number
  submittingUnit: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateInventoryPayloadT = {
  id: string
  number: string
  name: string
  fondId: string
  submissionYear: number
  submittingUnit: string
  isActive?: boolean
}

export type UpdateInventoryPayloadT = Partial<Omit<CreateInventoryPayloadT, 'id'>>

export type GetInventoriesParamsT = {
  page?: number
  limit?: number
  search?: string
}
