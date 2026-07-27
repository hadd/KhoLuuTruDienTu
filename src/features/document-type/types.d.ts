export interface DocumentTypeT {
  id: string
  name: string
  description: string
  retentionPeriodId: string | null
  isActive: boolean
  fileCount?: number
  inUse?: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type CreateDocumentTypePayloadT = {
  id: string
  name: string
  description?: string
  retentionPeriodId?: string | null
  isActive?: boolean
}

export type UpdateDocumentTypePayloadT = Partial<
  Omit<CreateDocumentTypePayloadT, 'id'>
>

export type GetDocumentTypesParamsT = {
  page?: number
  limit?: number
  search?: string
  sortBy?: 'id' | 'isActive'
  sortDir?: 'asc' | 'desc'
}
