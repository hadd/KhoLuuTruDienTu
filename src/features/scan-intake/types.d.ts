export interface ScanAgentHealth {
  status: string
  version?: string
  processBitness?: string
  twainSources?: Array<string>
  twainError?: string | null
  twainHint?: string | null
}

export interface ScanIntakePageInfo {
  key: string
  fileName: string
  sortOrder: number
  previewUrl?: string
}

export interface ScanIntakeInboxDoc {
  docSlug: string
  displayName: string
  pages: Array<ScanIntakePageInfo>
  pdfKey: string | null
  pageCount: number
  pdfUrl?: string | null
}

export interface ScanIntakeFolderPdf {
  name: string
  key: string
}

export interface ScanIntakeFolder {
  /** Relative path under session (may contain `/` for nested folders). */
  folderPath: string
  pdfs: Array<ScanIntakeFolderPdf>
}

export interface ScanIntakeSessionDetail {
  sessionId: string
  inbox: Array<ScanIntakeInboxDoc>
  folders: Array<ScanIntakeFolder>
}

export interface ScanIntakeSessionListItem {
  sessionId: string
  updatedAt: string | null
  inboxDocCount: number
  folderCount: number
}

export type ScanIntakePhase = 'scan' | 'organize'

export interface PromoteResult {
  batchId: string
  promoted: number
  results: Array<{
    folderPath: string
    pdfName: string
    rawKey: string
    dossierId: string
    fileId: string
    created: boolean
  }>
  errors: Array<{ folderPath: string; pdfName: string; error: string }>
}

export interface UploadPointResult {
  bucket: string
  key: string
  uploadUrl: string
  sessionId: string
}
