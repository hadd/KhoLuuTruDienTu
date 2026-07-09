export interface InventoryT {
  id: string
  number: string
  name: string
  fondId: string
  submissionYear: number
  submittingUnit: string
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
}

export type UpdateInventoryPayloadT = Omit<CreateInventoryPayloadT, 'id'>

export type GetInventoriesParamsT = {
  page?: number
  limit?: number
  search?: string
}
