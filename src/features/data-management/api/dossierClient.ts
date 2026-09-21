import { applyStoragePathPrefix } from '@/features/data-management/lib/uploadPathPrefix'
import { toScopedProjectCode } from '@/features/data-management/lib/constants'
import { sumUploadPdfPages } from '@/features/data-management/lib/countPdfFilePages'
import { checkPageQuotaUpload } from '@/features/metadata-extract/api/pageQuotaClient'
import { apiClient } from '@/lib/api/apiClient'
import { streamDownloadToDisk } from '@/lib/api/streamDownload'
import { env } from '@/lib/utils/env'
import {
  isPageQuotaUploadExceededMessage,
  translateError,
} from '@/lib/utils/translate-error'

/** ~10000 phút — export cây lớn có thể stream rất lâu. */
const EXPORT_TIMEOUT_MS = 10_000 * 60 * 1000

export type OcrRunMode = 'auto' | 'manual'

export interface UploadPointResponse {
  postURL: string
  formData: Record<string, string>
  prefix: string
  bucket: string
  runMode?: OcrRunMode
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
  /** OCR processing mode applied to the whole upload batch. Defaults to 'auto'. */
  runMode?: OcrRunMode
}

const UPLOAD_EXPIRY_MIN_SECONDS = 86_400
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
  runMode?: OcrRunMode,
): Promise<UploadPointResponse> {
  const response = await apiClient.post<unknown>(
    '/api/v1/dossiers/create-upload-point',
    {
      prefix: '/raw',
      expiry: expirySeconds,
      maxFileSize: env.DATA_UPLOAD_MAX_FILE_SIZE_BYTES,
      contentTypePrefix: '',
      runMode: runMode ?? 'auto',
    },
    { timeout: 0 },
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
  options?: Pick<UploadFolderOptions, 'storagePathPrefix' | 'runMode'>,
): Promise<UploadConflictCheckResult> {
  const uploadPoint = await createUploadPoint(
    computeUploadPointExpirySeconds(files.length),
    options?.runMode,
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
  projectCode?: string,
  runMode?: OcrRunMode,
): Promise<{
  folderId?: string
  dossierId?: string
}> {
  const body: { key: string; projectCode: string | null; runMode: OcrRunMode } =
  {
    key,
    projectCode: toScopedProjectCode(projectCode) ?? null,
    runMode: runMode ?? 'auto',
  }

  const response = await apiClient.post<Record<string, unknown>>(
    '/api/v1/dossiers/create-document-from-storage',
    body,
    { _skipGlobalErrorToast: true, timeout: 0 },
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

function normalizeMetadataExportFileName(fileName: string): string {
  if (/\.zip$/i.test(fileName)) return fileName
  const base = fileName.replace(/\.xlsx?$/i, '').replace(/\.+$/, '')
  return base ? `${base}.zip` : 'export.zip'
}

async function downloadMetadataExport(
  path: string,
  fallbackName: string,
  dossierId?: string,
  params?: Record<string, string | boolean | undefined>,
): Promise<void> {
  await streamDownloadToDisk({
    method: 'GET',
    path,
    fallbackFileName: normalizeMetadataExportFileName(fallbackName),
    dossierId: dossierId ?? null,
    params,
    timeoutMs: EXPORT_TIMEOUT_MS,
  })
}

async function downloadConfiguredMetadataExport(
  path: string,
  fallbackName: string,
  body: MetadataExportRequestT | Record<string, unknown>,
  dossierId?: string,
): Promise<void> {
  await streamDownloadToDisk({
    method: 'POST',
    path,
    body,
    fallbackFileName: normalizeMetadataExportFileName(fallbackName),
    dossierId: dossierId ?? null,
    timeoutMs: EXPORT_TIMEOUT_MS,
  })
}

export interface MetadataExportColumnRequestT {
  header: string
  fieldKeys: Array<string>
  separator: string
}

export interface MetadataExportRequestT {
  presetId?: string
  columns?: Array<MetadataExportColumnRequestT>
  useDocumentNaming?: boolean
  excelOnly?: boolean
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
  sampleValue?: string | null
  hasValue?: boolean
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

  if (
    config?.presetId ||
    config?.columns ||
    config?.useDocumentNaming ||
    config?.excelOnly
  ) {
    await downloadConfiguredMetadataExport(
      path,
      fallbackName,
      config,
      dossierId,
    )
    return
  }

  await downloadMetadataExport(path, fallbackName, dossierId)
}

export async function exportMultiDossiersMetadataExcel(
  dossierIds: string[],
  downloadName?: string,
  config?: MetadataExportRequestT,
): Promise<void> {
  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}.zip`
    : `multi-dossiers.zip`
  const path = `/api/v1/dossiers/metadata/export`
  const body = {
    ...config,
    dossierIds,
  }
  await downloadConfiguredMetadataExport(path, fallbackName, body)
}

export async function exportMultiFoldersMetadataExcel(
  folderIds: string[],
  downloadName?: string,
  config?: MetadataExportRequestT,
): Promise<void> {
  if (folderIds.length === 0) return
  if (folderIds.length === 1) {
    await exportFolderMetadataExcel(folderIds[0]!, downloadName, config)
    return
  }
  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}.zip`
    : `multi-folders.zip`
  await downloadConfiguredMetadataExport(
    `/api/v1/folders/metadata/export`,
    fallbackName,
    {
      ...config,
      folderIds,
    } as MetadataExportRequestT & { folderIds: string[] },
  )
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

  if (
    config?.presetId ||
    config?.columns ||
    config?.useDocumentNaming ||
    config?.excelOnly
  ) {
    await downloadConfiguredMetadataExport(path, fallbackName, config)
    return
  }

  await downloadMetadataExport(path, fallbackName)
}

export type DipExportOptionsT = {
  useDocumentNaming?: boolean
}

export async function exportDossierDip(
  dossierId: string,
  downloadName?: string,
  options?: DipExportOptionsT,
): Promise<void> {
  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}-dip.zip`
    : `dossier-${dossierId}-dip.zip`
  await downloadMetadataExport(
    `/api/v1/dossiers/${encodeURIComponent(dossierId)}/dip/export`,
    fallbackName,
    dossierId,
    options?.useDocumentNaming === true
      ? { useDocumentNaming: true }
      : undefined,
  )
}

export async function exportMultiDossiersDip(
  dossierIds: string[],
  downloadName?: string,
  baseFolderId?: string,
  options?: DipExportOptionsT,
  folderIds?: string[],
): Promise<void> {
  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}-dip.zip`
    : `multi-dossiers-dip.zip`
  const resolvedFolderIds = folderIds?.length
    ? folderIds
    : baseFolderId
      ? [baseFolderId]
      : undefined
  await downloadConfiguredMetadataExport(
    `/api/v1/dossiers/dip/export`,
    fallbackName,
    {
      dossierIds,
      ...(resolvedFolderIds ? { folderIds: resolvedFolderIds } : {}),
      baseFolderId: baseFolderId ?? resolvedFolderIds?.[0],
      ...(options?.useDocumentNaming === true
        ? { useDocumentNaming: true }
        : {}),
    } as MetadataExportRequestT & {
      dossierIds: string[]
      folderIds?: string[]
      baseFolderId?: string
    },
  )
}

export async function exportFolderDip(
  folderId: string,
  downloadName?: string,
  options?: DipExportOptionsT,
): Promise<void> {
  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}-dip.zip`
    : `folder-dip.zip`
  await downloadConfiguredMetadataExport(
    `/api/v1/dossiers/dip/export`,
    fallbackName,
    {
      dossierIds: [],
      folderIds: [folderId],
      baseFolderId: folderId,
      ...(options?.useDocumentNaming === true
        ? { useDocumentNaming: true }
        : {}),
    } as MetadataExportRequestT & {
      dossierIds: string[]
      folderIds: string[]
      baseFolderId: string
    },
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

  const totalPages = await sumUploadPdfPages(files)
  const quotaCheck = await checkPageQuotaUpload(totalPages)
  if (!quotaCheck.allowed) {
    const message =
      quotaCheck.message ??
      `Không đủ hạn mức bóc tách: lượt tải có ${totalPages} trang, chỉ còn ${quotaCheck.remaining ?? 0} trang. Hãy nạp thêm license hoặc giảm số trang.`
    throw new Error(message)
  }

  const uploadPoint =
    options?.uploadPoint ??
    (await createUploadPoint(
      computeUploadPointExpirySeconds(files.length),
      options?.runMode,
    ))

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
          uploadPoint.runMode ?? options?.runMode,
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
      const error = translateError(err)
      results.push({ file, relativePath, status: 'error', error })
      if (isPageQuotaUploadExceededMessage(error)) {
        break
      }
    }
  }

  onProgress?.({
    total: files.length,
    completed: results.length,
    currentFile: '',
    phase: 'uploading',
  })

  return { results, uploadPoint }
}
