import type { OcrRunMode } from '@/features/data-management/api/dossierClient'
import type {
  PromoteResult,
  ScanAgentHealth,
  ScanIntakeSessionDetail,
  ScanIntakeSessionListItem,
  UploadPointResult,
} from '@/features/scan-intake/types'
import { apiClient } from '@/lib/api/apiClient'

const AGENT_V2_MIN_VERSION = 2

export async function checkScanAgentHealth(): Promise<ScanAgentHealth> {
  const response = await fetch('http://127.0.0.1:18612/health')
  if (!response.ok) {
    throw new Error(`Scan agent offline (${response.status})`)
  }
  return response.json() as Promise<ScanAgentHealth>
}

export function isAgentV2(health?: ScanAgentHealth | null): boolean {
  if (!health?.version) return false
  const major = parseInt(health.version.split('.')[0] ?? '0', 10)
  return major >= AGENT_V2_MIN_VERSION
}

export class ScanAgentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ScanAgentError'
  }
}

export interface ScanOptions {
  uploadUrl?: string
  uploadUrls?: Array<string>
  showUi?: boolean
  dpi?: number
  colorMode?: 'bw' | 'gray' | 'color'
  twainSource?: string
  adf?: boolean
  duplex?: boolean
}

export type ScanToMinioResult =
  | { uploaded: true; pageCount: number }
  | { cancelled: true }
  | Blob

async function postScan(options: ScanOptions, path: string): Promise<Response> {
  const batchMode = options.adf || options.duplex
  return fetch(`http://127.0.0.1:18612${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadUrl: options.uploadUrl,
      uploadUrls: options.uploadUrls,
      showUi: options.showUi ?? !batchMode,
      dpi: options.dpi ?? 300,
      colorMode: options.colorMode ?? 'bw',
      twainSource: options.twainSource,
      adf: options.adf ?? false,
      duplex: options.duplex ?? false,
    }),
  })
}

export async function scanToMinio(
  options: ScanOptions,
): Promise<ScanToMinioResult> {
  let response = await postScan(options, '/scan')

    if (response.status === 404) {
    response = await postScan(options, '/documents/default/scan')
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    if (response.status === 404) {
      throw new ScanAgentError(
        'Scan Agent v2 required (endpoint /scan not found). Rebuild and restart SohoaScanAgent.exe.',
        404,
      )
    }
    throw new ScanAgentError(text || `Scan failed ${response.status}`, response.status)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = (await response.json()) as {
      cancelled?: boolean
      uploaded?: boolean
      pageCount?: number
    }
    if (json.cancelled) return { cancelled: true }
    if (json.uploaded) return { uploaded: true, pageCount: json.pageCount ?? 1 }
  }

  return response.blob()
}

export async function listScanSessions(): Promise<Array<ScanIntakeSessionListItem>> {
  const response = await apiClient.get<{ sessions: Array<ScanIntakeSessionListItem> }>(
    '/api/v1/scan-intake/sessions',
  )
  return response.data.sessions
}

export async function getScanSession(
  sessionId: string,
): Promise<ScanIntakeSessionDetail> {
  const response = await apiClient.get<ScanIntakeSessionDetail>(
    '/api/v1/scan-intake/session',
    { params: { sessionId } },
  )
  return response.data
}

export async function createPageUploadPoint(input: {
  sessionId: string
  docSlug: string
  fileName: string
}): Promise<UploadPointResult> {
  const response = await apiClient.post<UploadPointResult>(
    '/api/v1/scan-intake/upload-point',
    input,
  )
  return response.data
}

export async function presignedGet(input: { key: string }): Promise<string> {
  const response = await apiClient.post<{ url: string }>(
    '/api/v1/scan-intake/presigned-get',
    input,
  )
  return response.data.url
}

export async function uploadBlobToPresignedUrl(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  })
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`)
  }
}

export async function assemblePdf(input: {
  sessionId: string
  docSlug: string
  displayName?: string
}): Promise<{ pdfKey: string; pageCount: number; url: string | null }> {
  const response = await apiClient.post<{
    pdfKey: string
    pageCount: number
    url: string | null
  }>('/api/v1/scan-intake/assemble-pdf', input)
  return response.data
}

export async function reorderPages(input: {
  sessionId: string
  docSlug: string
  pageKeys: Array<string>
}): Promise<void> {
  await apiClient.post('/api/v1/scan-intake/pages/reorder', input, {
    _skipGlobalErrorToast: true,
  })
}

export async function deletePageObject(key: string): Promise<void> {
  await apiClient.post('/api/v1/scan-intake/pages/delete', { key })
}

export async function deletePagesBulk(keys: Array<string>): Promise<void> {
  await apiClient.post('/api/v1/scan-intake/pages/delete-bulk', { keys })
}

export async function deleteDocumentDraft(input: {
  sessionId: string
  docSlug: string
}): Promise<void> {
  await apiClient.post('/api/v1/scan-intake/document/delete', input)
}

export async function organizeMove(input: {
  sessionId: string
  sourceKey: string
  destKey: string
}): Promise<void> {
  await apiClient.post('/api/v1/scan-intake/organize-move', input)
}

export async function organizeRenameFolder(input: {
  sessionId: string
  folderPath: string
  newName: string
}): Promise<{ folderPath: string; renamed: number }> {
  const response = await apiClient.post<{ folderPath: string; renamed: number }>(
    '/api/v1/scan-intake/organize-rename-folder',
    input,
  )
  return response.data
}

export async function organizeRenamePdf(input: {
  sessionId: string
  pdfKey: string
  newName: string
}): Promise<{ pdfKey: string; renamed: boolean }> {
  const response = await apiClient.post<{ pdfKey: string; renamed: boolean }>(
    '/api/v1/scan-intake/organize-rename-pdf',
    input,
  )
  return response.data
}

export async function promoteSession(input: {
  projectCode?: string | null  // ✅ Cho phép null hoặc undefined
  sessionId: string
  targetFolderPath: string
  organizeFolderPath?: string
  pdfKeys?: Array<string>
  folderPaths?: Array<string>
  cleanup?: boolean
  runMode?: OcrRunMode
}): Promise<PromoteResult> {
  const response = await apiClient.post<PromoteResult>(
    '/api/v1/scan-intake/promote',
    input,
  )
  return response.data
}

export async function deleteScanSession(sessionId: string): Promise<void> {
  await apiClient.post('/api/v1/scan-intake/session/delete', { sessionId })
}

export async function attachPreviewUrls(
  session: ScanIntakeSessionDetail,
): Promise<ScanIntakeSessionDetail> {
  const inbox = await Promise.all(
    session.inbox.map(async (doc) => {
      const pages = await Promise.all(
        doc.pages.map(async (page) => ({
          ...page,
          previewUrl: await presignedGet({ key: page.key }),
        })),
      )
      const pdfUrl = doc.pdfKey
        ? await presignedGet({ key: doc.pdfKey })
        : null
      return { ...doc, pages, pdfUrl }
    }),
  )
  return { ...session, inbox }
}
