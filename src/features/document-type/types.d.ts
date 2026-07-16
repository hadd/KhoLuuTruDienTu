export interface DocumentTypeT {
  id: string
  name: string
  description: string
  retentionPeriodId: string | null
  isActive: boolean
  /** Số file đang gắn loại này (từ list API). */
  fileCount?: number
  /** true nếu đang được ít nhất một file sử dụng. */
  inUse?: boolean
  createdAt: string
  updatedAt: string
}

export type CreateDocumentTypePayloadT = {
  id: string
  name: string
  description?: string
  retentionPeriodId?: string | null
  isActive?: boolean
}

export type UpdateDocumentTypePayloadT = {
  name?: string
  description?: string
  retentionPeriodId?: string | null
  isActive?: boolean
}

export type GetDocumentTypesParamsT = {
  page?: number
  limit?: number
  search?: string
}
