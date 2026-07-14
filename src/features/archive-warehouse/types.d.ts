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
  hoSoId?: string | null
  trangThaiHoSo?: string | null
  snippet: string
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
  q: string
  fondId?: string
  limit?: number
  offset?: number
  groupCode?: string
  trangThaiHoSo?: string
}

export type ArchiveWarehouseReuploadResultT = {
  sourceDossierId: string
  sourceFileId: string
  dossier: {
    id: string
    name: string
    folderPath: string | null
    status: string
    projectCode: string | null
  }
  file: {
    id: string
    fileName: string
    filePath: string
  }
  created: boolean
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
