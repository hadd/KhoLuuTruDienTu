export interface ArchiveFondT {
  id: string
  fondName: string
  archiveAgency: string
  adminstrativeHistory: string
  fondType: string
  dossierCount: number
  isActive: boolean
  hasZipPassword: boolean
  zipPasswordEnabled: boolean
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
  zipPasswordEnabled?: boolean
  zipPassword?: string | null
}

export type UpdateArchiveFondPayloadT = Partial<
  Omit<CreateArchiveFondPayloadT, 'id'>
> & {
  isActive?: boolean
  zipPasswordEnabled?: boolean
  /** Omit to keep; empty string/null to clear; non-empty to set. */
  zipPassword?: string | null
}

export type GetArchiveFondsParamsT = {
  page?: number
  limit?: number
  search?: string
}
