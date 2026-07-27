export type OcrTrackedUiStatusT = 'processing' | 'completed' | 'failed'

export interface OcrPendingFileT {
  id: string
  fileName: string
  filePath: string
  createdAt: string
}

export interface OcrPendingDossierT {
  dossierId: string
  dossierName: string
  folderPath: string
  projectCode: string | null
  pendingFileCount: number
  oldestPendingAt: string
  pendingFiles: Array<OcrPendingFileT>
}

export interface OcrPendingDossiersResultT {
  items: Array<OcrPendingDossierT>
  totalDossiers: number
  page: number
  pageSize: number
}

export interface OcrTrackedFileT {
  id: string
  fileName: string
  filePath: string
  ocrTriggeredAt: string | null
}

export interface OcrTrackedDossierT {
  dossierId: string
  dossierName: string
  folderPath: string
  folderId: string
  projectCode: string | null
  status: string
  uiStatus: OcrTrackedUiStatusT
  triggeredFileCount: number
  latestTriggeredAt: string
  triggeredFiles: Array<OcrTrackedFileT>
}

export interface OcrTrackedDossiersResultT {
  items: Array<OcrTrackedDossierT>
  totalDossiers: number
  page: number
  pageSize: number
  summary: {
    processingCount: number
    completedCount: number
    failedCount: number
  }
}

export interface OcrTriggerResultItemT {
  dossierId: string
  success: boolean
  triggeredFileCount: number
  error?: string
}

export interface OcrTriggerResponseT {
  results: Array<OcrTriggerResultItemT>
}
