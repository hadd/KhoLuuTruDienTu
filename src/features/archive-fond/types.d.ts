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

export type UpdateArchiveFondPayloadT = Partial<
  Omit<CreateArchiveFondPayloadT, 'id'>
> & {
  isActive?: boolean
}

export type GetArchiveFondsParamsT = {
  page?: number
  limit?: number
  search?: string
}
