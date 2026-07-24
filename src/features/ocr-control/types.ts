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

export interface OcrTriggerResultItemT {
  dossierId: string
  success: boolean
  triggeredFileCount: number
  error?: string
}

export interface OcrTriggerResponseT {
  results: Array<OcrTriggerResultItemT>
}
