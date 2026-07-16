export interface DossierTypeT {
  id: string
  name: string
  description: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateDossierTypePayloadT = {
  id: string
  name: string
  description?: string
  isActive?: boolean
}

export type UpdateDossierTypePayloadT = Partial<Omit<CreateDossierTypePayloadT, 'id'>>

export type GetDossierTypesParamsT = {
  page?: number
  limit?: number
  search?: string
}
