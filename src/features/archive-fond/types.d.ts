export interface ArchiveFondT {
  id: string
  fondName: string
  archiveAgency: string
  adminstrativeHistory: string
  fondType: string
  dossierCount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CreateArchiveFondPayloadT = {
  id: string
  fondName: string
  archiveAgency: string
  adminstrativeHistory: string
  fondType: string
}

export type UpdateArchiveFondPayloadT = Omit<CreateArchiveFondPayloadT, 'id'>

export type GetArchiveFondsParamsT = {
  page?: number
  limit?: number
  search?: string
}
