export interface DossierTypeT {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export type CreateDossierTypePayloadT = {
  id: string
  name: string
  description?: string
}

export type UpdateDossierTypePayloadT = Omit<CreateDossierTypePayloadT, 'id'>

export type GetDossierTypesParamsT = {
  page?: number
  limit?: number
  search?: string
}
