import type { ArchiveFieldConfigT } from '@/features/archive-config/types'
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
  fileSizeKb: number | null
  createdAt: string
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
}

export type GetArchiveWarehouseFondSummaryParamsT = {
  fondId: string
  status?: WarehouseDossierStatusT
}
