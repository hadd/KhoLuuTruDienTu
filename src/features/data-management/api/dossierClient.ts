import { applyStoragePathPrefix } from '@/features/data-management/lib/uploadPathPrefix'
import { apiClient } from '@/lib/api/apiClient'
import { env } from '@/lib/utils/env'

export interface UploadPointResponse {
  postURL: string
  formData: Record<string, string>
  prefix: string
  bucket: string
}

export interface FileUploadResult {
  file: File
  relativePath: string
  status: 'uploaded' | 'skipped' | 'error'
  error?: string
  storageKey?: string
  folderId?: string
  dossierId?: string
}

export interface UploadFolderResult {
  results: Array<FileUploadResult>
  /** Upload point used for this batch (for conflict retry). */
  uploadPoint: UploadPointResponse
}

export interface UploadProgress {
  total: number
  completed: number
  currentFile: string
  phase: 'preparing' | 'uploading'
}

export interface UploadFolderOptions {
  uploadPoint?: UploadPointResponse
  /** When true, skip path-exists check and upload to MinIO (fallback after permanent delete). */
  allowOverwrite?: boolean
  /**
   * When true, skip per-file path-exists check during upload.
   * Use after document pre-flight (`detectUploadPathConflicts`) already verified paths.
   */
  skipPathCheck?: boolean
  /** Scope uploaded documents to the selected project. */
  projectCode?: string
  /** Path segment(s) after /raw/, e.g. "abc" or "parent/child" */
  storagePathPrefix?: string
}

const UPLOAD_EXPIRY_MIN_SECONDS = 60
const CONFLICT_CHECK_CONCURRENCY = 10

export interface UploadPathConflict {
  relativePath: string
  storageKey: string
}

export interface UploadConflictCheckResult {
  conflicts: Array<UploadPathConflict>
  uploadPoint: UploadPointResponse
}

function resolveUploadBaseKey(uploadPoint: UploadPointResponse): string {
  return uploadPoint.prefix.endsWith('/')
    ? uploadPoint.prefix
    : `${uploadPoint.prefix}/`
}

function resolveRelativePath(file: File): string {
  return file.webkitRelativePath || file.name
}

function resolveUploadRelativePath(
  file: File,
  storagePathPrefix?: string,
): string {
  return applyStoragePathPrefix(resolveRelativePath(file), storagePathPrefix)
}

function resolveStorageKey(
  uploadPoint: UploadPointResponse,
  relativePath: string,
): string {
  return resolveUploadBaseKey(uploadPoint) + relativePath
}

function computeUploadPointExpirySeconds(fileCount: number): number {
  if (fileCount <= 0) return UPLOAD_EXPIRY_MIN_SECONDS
  const perFile = env.DATA_UPLOAD_EXPIRY_SECONDS_PER_FILE
  return Math.max(UPLOAD_EXPIRY_MIN_SECONDS, fileCount * perFile)
}

function unwrapApiRecord<T>(data: unknown): T {
  if (data && typeof data === 'object' && 'record' in data) {
    const record = (data as { record: unknown }).record
    if (record && typeof record === 'object') {
      return record as T
    }
  }
  return data as T
}

async function createUploadPoint(
  expirySeconds: number,
): Promise<UploadPointResponse> {
  const response = await apiClient.post<unknown>(
    '/api/v1/dossiers/create-upload-point',
    {
      prefix: '/raw',
      expiry: expirySeconds,
      maxFileSize: env.DATA_UPLOAD_MAX_FILE_SIZE_BYTES,
      contentTypePrefix: '',
    },
  )

  const uploadPoint = unwrapApiRecord<UploadPointResponse>(response.data)
  if (!uploadPoint.postURL?.trim()) {
    throw new Error(
      'Phản hồi create-upload-point không hợp lệ: thiếu postURL (kiểm tra format { record }).',
    )
  }

  return uploadPoint
}

async function checkFilePath(filePath: string): Promise<boolean> {
  const response = await apiClient.get<unknown>(
    `/api/v1/dossiers/check-file-path?filePath=${encodeURIComponent(filePath)}`,
  )

  const payload = unwrapApiRecord<{ exists?: boolean }>(response.data)
  return Boolean(payload.exists)
}

async function mapWithConcurrency<T, R>(
  items: Array<T>,
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<Array<R>> {
  const results: Array<R> = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}

/** Pre-flight: detect files whose storage path already exists (same check as upload skip). */
export async function detectUploadPathConflicts(
  files: Array<File>,
  options?: Pick<UploadFolderOptions, 'storagePathPrefix'>,
): Promise<UploadConflictCheckResult> {
  const uploadPoint = await createUploadPoint(
    computeUploadPointExpirySeconds(files.length),
  )

  const checks = await mapWithConcurrency(
    files,
    CONFLICT_CHECK_CONCURRENCY,
    async (file) => {
      const relativePath = resolveUploadRelativePath(
        file,
        options?.storagePathPrefix,
      )
      const storageKey = resolveStorageKey(uploadPoint, relativePath)
      const exists = await checkFilePath(storageKey)
      return exists ? { relativePath, storageKey } : null
    },
  )

  const conflicts = checks.filter(
    (item): item is UploadPathConflict => item != null,
  )

  return { conflicts, uploadPoint }
}

async function createDocumentFromStorage(
  key: string,
  _projectCode?: string,
): Promise<{
  folderId?: string
  dossierId?: string
}> {
  // Uploads always land under raw/ which is never scoped to a project, so the
  // document is registered without a projectCode (the API defaults raw/ to null).
  const body: { key: string; projectCode: null } = { key, projectCode: null }

  const response = await apiClient.post<Record<string, unknown>>(
    '/api/v1/dossiers/create-document-from-storage',
    body,
  )

  const data = unwrapApiRecord<Record<string, unknown>>(response.data)
  const record = data

  const dossier = record.dossier
  const folder = record.folder

  const dossierId =
    readId(record, ['dossierId', 'dossier_id']) ??
    (dossier && typeof dossier === 'object'
      ? readId(dossier as Record<string, unknown>, ['id'])
      : undefined)

  const folderId =
    readId(record, ['folderId', 'folder_id']) ??
    (folder && typeof folder === 'object'
      ? readId(folder as Record<string, unknown>, ['id'])
      : undefined)

  return { dossierId, folderId }
}

function readId(
  source: Record<string, unknown>,
  keys: Array<string>,
): string | undefined {
  for (const key of keys) {
    const value = source[key]
    if (value != null && String(value).trim()) {
      return String(value)
    }
  }
  return undefined
}

async function uploadFileToMinIO(
  file: File,
  uploadPoint: UploadPointResponse,
  relativePath: string,
): Promise<void> {
  const baseKey = resolveUploadBaseKey(uploadPoint)

  const form = new FormData()
  for (const [k, v] of Object.entries(uploadPoint.formData)) {
    if (k === 'key') {
      form.append('key', baseKey + relativePath)
    } else {
      form.append(k, v)
    }
  }
  form.append('file', file)

  const response = await fetch(uploadPoint.postURL, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
  }
}

function resolveDownloadFileName(
  contentDisposition: string | undefined,
  fallbackName: string,
): string {
  if (!contentDisposition) return fallbackName

  const match = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(contentDisposition)
  if (!match?.[1]) return fallbackName

  return decodeURIComponent(match[1].replace(/"/g, ''))
}

/** Metadata export endpoints return a ZIP archive, not a single .xlsx file. */
function normalizeMetadataExportFileName(fileName: string): string {
  if (/\.zip$/i.test(fileName)) return fileName
  const base = fileName.replace(/\.xlsx?$/i, '').replace(/\.+$/, '')
  return base ? `${base}.zip` : 'export.zip'
}

async function downloadMetadataExport(
  path: string,
  fallbackName: string,
): Promise<void> {
  const response = await apiClient.get<Blob>(path, {
    responseType: 'blob',
    _skipGlobalErrorToast: true,
  })

  await saveMetadataExportBlob(response.data, response.headers['content-disposition'], fallbackName)
}

async function downloadConfiguredMetadataExport(
  path: string,
  fallbackName: string,
  body: MetadataExportRequestT,
): Promise<void> {
  const response = await apiClient.post<Blob>(path, body, {
    responseType: 'blob',
    _skipGlobalErrorToast: true,
  })

  await saveMetadataExportBlob(response.data, response.headers['content-disposition'], fallbackName)
}

async function saveMetadataExportBlob(
  data: Blob,
  contentDisposition: string | undefined,
  fallbackName: string,
): Promise<void> {
  const fileName = normalizeMetadataExportFileName(
    resolveDownloadFileName(contentDisposition, fallbackName),
  )

  const url = window.URL.createObjectURL(new Blob([data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export interface MetadataExportColumnRequestT {
  header: string
  fieldKeys: Array<string>
  separator: string
}

export interface MetadataExportRequestT {
  presetId?: string
  columns?: Array<MetadataExportColumnRequestT>
}

export interface MetadataExportPreviewRowT {
  rowLabel: string
  cells: Array<string>
}

export interface MetadataExportPreviewResultT {
  headers: string[]
  rows: Array<MetadataExportPreviewRowT>
  totalCount: number
  previewCount: number
}

export async function previewDossierMetadataExport(
  dossierId: string,
  config: MetadataExportRequestT,
): Promise<MetadataExportPreviewResultT> {
  const response = await apiClient.post<MetadataExportPreviewResultT>(
    `/api/v1/dossiers/${encodeURIComponent(dossierId)}/metadata/export/preview`,
    config,
  )
  return response.data
}

export async function previewFolderMetadataExport(
  folderId: string,
  config: MetadataExportRequestT,
): Promise<MetadataExportPreviewResultT> {
  const response = await apiClient.post<MetadataExportPreviewResultT>(
    `/api/v1/folders/${encodeURIComponent(folderId)}/metadata/export/preview`,
    config,
  )
  return response.data
}

export async function fetchDossierMetadataExportFields(
  dossierId: string,
): Promise<Array<MetadataExportFieldCatalogItemT>> {
  const response = await apiClient.get<Array<MetadataExportFieldCatalogItemT>>(
    `/api/v1/dossiers/${encodeURIComponent(dossierId)}/metadata/export/fields`,
  )
  return response.data
}

export async function fetchFolderMetadataExportFields(
  folderId: string,
): Promise<Array<MetadataExportFieldCatalogItemT>> {
  const response = await apiClient.get<Array<MetadataExportFieldCatalogItemT>>(
    `/api/v1/folders/${encodeURIComponent(folderId)}/metadata/export/fields`,
  )
  return response.data
}

export interface MetadataExportFieldCatalogItemT {
  key: string
  groupCode: string
  groupName: string
  fieldName: string
  display: string
}

export async function exportDossierMetadataExcel(
  dossierId: string,
  downloadName?: string,
  config?: MetadataExportRequestT,
): Promise<void> {
  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}.zip`
    : `dossier-${dossierId}.zip`
  const path = `/api/v1/dossiers/${encodeURIComponent(dossierId)}/metadata/export`

  if (config?.presetId || config?.columns) {
    await downloadConfiguredMetadataExport(path, fallbackName, config)
    return
  }

  await downloadMetadataExport(path, fallbackName)
}

export async function exportFolderMetadataExcel(
  folderId: string,
  downloadName?: string,
  config?: MetadataExportRequestT,
): Promise<void> {
  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}.zip`
    : `folder-${folderId}.zip`
  const path = `/api/v1/folders/${encodeURIComponent(folderId)}/metadata/export`

  if (config?.presetId || config?.columns) {
    await downloadConfiguredMetadataExport(path, fallbackName, config)
    return
  }

  await downloadMetadataExport(path, fallbackName)
}

export async function exportDossierDip(
  dossierId: string,
  downloadName?: string,
): Promise<void> {
  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}-dip.zip`
    : `dossier-${dossierId}-dip.zip`
  await downloadMetadataExport(
    `/api/v1/dossiers/${encodeURIComponent(dossierId)}/dip/export`,
    fallbackName,
  )
}

export async function uploadFolderFiles(
  files: Array<File>,
  onProgress?: (progress: UploadProgress) => void,
  options?: UploadFolderOptions,
): Promise<UploadFolderResult> {
  const allowOverwrite = options?.allowOverwrite === true
  const skipPathCheck = options?.skipPathCheck === true
  onProgress?.({
    total: files.length,
    completed: 0,
    currentFile: '',
    phase: 'preparing',
  })

  const uploadPoint =
    options?.uploadPoint ??
    (await createUploadPoint(computeUploadPointExpirySeconds(files.length)))

  const results: Array<FileUploadResult> = []

  for (const [index, file] of files.entries()) {
    const relativePath = resolveUploadRelativePath(
      file,
      options?.storagePathPrefix,
    )
    const fullKey = resolveStorageKey(uploadPoint, relativePath)

    onProgress?.({
      total: files.length,
      completed: index,
      currentFile: relativePath,
      phase: 'uploading',
    })

    try {
      const exists =
        allowOverwrite || skipPathCheck ? false : await checkFilePath(fullKey)

      if (exists) {
        results.push({
          file,
          relativePath,
          status: 'skipped',
          storageKey: fullKey,
        })
      } else {
        await uploadFileToMinIO(file, uploadPoint, relativePath)
        const created = await createDocumentFromStorage(
          fullKey,
          options?.projectCode,
        )
        results.push({
          file,
          relativePath,
          status: 'uploaded',
          storageKey: fullKey,
          folderId: created.folderId,
          dossierId: created.dossierId,
        })
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      results.push({ file, relativePath, status: 'error', error })
    }
  }

  onProgress?.({
    total: files.length,
    completed: files.length,
    currentFile: '',
    phase: 'uploading',
  })

  return { results, uploadPoint }
}
