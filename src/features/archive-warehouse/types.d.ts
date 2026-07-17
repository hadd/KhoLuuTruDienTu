import type {
  ArchiveFieldConfigSnapshotT,
  ArchiveFieldValueSnapshotT,
} from '@/features/archive-submission/types'

export type WarehouseDossierStatusT = 'ARCHIVED'

export type ArchiveWarehouseDossierItemT = {
  id: string
  name: string
  folderPath: string | null
  status: WarehouseDossierStatusT | string
  projectCode: string | null
  fondId: string | null
  fondName: string | null
  updatedAt: string
  documentCount: number
  totalSizeKb: number
  archivedAt: string | null
  archiveYear: number | null
  hasPhysicalPlacement?: boolean
  effectiveRetentionPeriodId?: string | null
  effectiveRetentionPeriodName?: string | null
}

export type GetArchiveWarehouseDossiersParamsT = {
  page?: number
  limit?: number
  search?: string
  fondId: string
  year?: number
  status?: WarehouseDossierStatusT
}

export type ArchiveWarehouseDossiersResponseT = {
  items: Array<ArchiveWarehouseDossierItemT>
  page: number
  limit: number
  total: number
  totalPages: number
  fondScope: Array<string> | null
  fondId: string
}

export type ArchiveWarehouseFondSummaryT = {
  fondId: string
  dossierCount: number
  documentCount: number
  totalSizeKb: number
  availableYears: Array<number>
  fondScope: Array<string> | null
}

export type ArchiveWarehouseDossierFileT = {
  id: string
  fileName: string
  filePath?: string
  fileSizeKb: number | null
  documentTypeId?: string | null
  documentTypeName?: string | null
  createdAt: string
  fileUrl?: string
  searchablePdfPath?: string | null
  searchablePdfUrl?: string | null
}

export type ArchiveWarehouseDossierDetailT = {
  dossier: ArchiveWarehouseDossierItemT
  archiveSubmission: {
    reviewedAt: string | null
    fieldValues: ArchiveFieldValueSnapshotT
    fieldConfigSnapshot: ArchiveFieldConfigSnapshotT
    archiveYear: number | null
  } | null
  files: Array<ArchiveWarehouseDossierFileT>
  currentMetadataUrl?: string | null
}

export type GetArchiveWarehouseFondSummaryParamsT = {
  fondId: string
  status?: WarehouseDossierStatusT
}

export type ArchiveWarehouseSearchMatchT = {
  groupCode: string
  groupName: string
  name: string
  display: string
  value: string
  fileName: string | null
  filePath: string | null
  page: number | null
  bbox: number[] | null
  highlight: string
}

export type ArchiveWarehouseSearchHitT = {
  entityType: string
  entityId: string
  title: string
  fondId: string | null
  fondName?: string | null
  dossierTypeId?: string | null
  dossierTypeName?: string | null
  documentTypeIds?: Array<string>
  documentTypeNames?: Array<string>
  effectiveRetentionPeriodId?: string | null
  effectiveRetentionPeriodName?: string | null
  editorId?: string | null
  editorName?: string | null
  editCompletedAt?: string | null
  archivedAt?: string | null
  fileNames?: Array<string>
  hoSoId?: string | null
  trangThaiHoSo?: string | null
  snippet?: string
  score: number
  matches?: Array<ArchiveWarehouseSearchMatchT>
  metadata: Record<string, unknown>
}

export type ArchiveWarehouseSearchResponseT = {
  items: Array<ArchiveWarehouseSearchHitT>
  total: number
  took_ms: number
  fondScope: Array<string> | null
  message: string | null
}

export type GetArchiveWarehouseSearchParamsT = {
  mode?: 'metadata' | 'content'
  q?: string
  dossierName?: string
  documentName?: string
  fondId?: string
  dossierTypeId?: string
  documentTypeId?: string
  editorName?: string
  editCompletedAtFrom?: string
  editCompletedAtTo?: string
  archivedAtFrom?: string
  archivedAtTo?: string
  limit?: number
  offset?: number
  groupCode?: string
  trangThaiHoSo?: string
}

export type ArchiveWarehouseDossierTypeT = {
  id: string
  name: string
}

export type ArchiveWarehouseDocumentTypeT = {
  id: string
  name: string
}

export type ArchiveWarehouseReuploadResultT = {
  dossierId: string
  fileId: string
  file: {
    id: string
    fileName: string
    filePath: string
    fileSizeKb: number | null
  }
  status: string
  fromStatus: string
  message: string
}

export type ArchiveWarehouseDeleteFileResultT = {
  dossierId: string
  deletedFileId: string
  status: string
  message: string
}

export type ArchiveWarehouseBulkDeleteFilesResultT = {
  dossierId: string
  deletedFileIds: Array<string>
  deletedCount: number
  status: string
  message: string
}

export type ArchiveWarehouseMoveFileResultT = {
  sourceDossierId: string
  targetDossierId: string
  fileId: string
  sourceStatus: string
  targetStatus: string
  message: string
}

export type ArchiveWarehouseBulkMoveFilesResultT = {
  sourceDossierId: string
  targetDossierId: string
  movedFiles: Array<{
    fileId: string
    destFileName: string
    destFilePath: string
    renamed: boolean
  }>
  movedCount: number
  sourceStatus: string
  targetStatus: string
  message: string
}

export type ArchiveWarehouseReuploadUploadPointT = {
  postURL: string
  formData: Record<string, string>
  prefix: string
  bucket: string
  sourceFileId: string
  sourceFileName: string
  suggestedFileName: string
}
