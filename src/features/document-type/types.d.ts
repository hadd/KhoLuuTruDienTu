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

export type GetDocumentTypesParamsT = {
  page?: number
  limit?: number
  search?: string
}
