import { applyStoragePathPrefix } from '@/features/data-management/lib/uploadPathPrefix'
import { toScopedProjectCode } from '@/features/data-management/lib/constants'
import { sumUploadPdfPages } from '@/features/data-management/lib/countPdfFilePages'
import {
  CHECK_MULTI_FILE_PATH_CHUNK_SIZE,
  CREATE_MULTI_DOCUMENT_CHUNK_SIZE,
  isAbortError,
  mapWithConcurrency,
  throwIfAborted,
  UPLOAD_FILE_CONCURRENCY,
  withUploadRetry,
} from '@/features/data-management/lib/uploadConcurrency'
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
   * When true, skip batch path-exists check during upload.
   * Use after document pre-flight (`detectUploadPathConflicts`) already verified paths.
   */
  skipPathCheck?: boolean
  /** Scope uploaded documents to the selected project. */
  projectCode?: string
  /** Path segment(s) after /raw/, e.g. "abc" or "parent/child" */
  storagePathPrefix?: string
  /** OCR processing mode applied to the whole upload batch. Defaults to 'auto'. */
  runMode?: OcrRunMode
  /** Abort in-flight MinIO uploads and stop claiming new files. */
  signal?: AbortSignal
}

const UPLOAD_EXPIRY_MIN_SECONDS = 86_400

export interface UploadPathConflict {
  relativePath: string
  storageKey: string
}

export interface UploadConflictCheckResult {
  conflicts: Array<UploadPathConflict>
  uploadPoint: UploadPointResponse
}

interface CheckMultiFilePathItem {
  path: string
  exists: boolean
  fileId: string | null
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

async function checkMultiFilePath(
  filePaths: Array<string>,
): Promise<Array<CheckMultiFilePathItem>> {
  if (filePaths.length === 0) return []

  const chunks: Array<Array<string>> = []
  for (let i = 0; i < filePaths.length; i += CHECK_MULTI_FILE_PATH_CHUNK_SIZE) {
    chunks.push(filePaths.slice(i, i + CHECK_MULTI_FILE_PATH_CHUNK_SIZE))
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const normalizedChunk = chunk.map((path) => path.replace(/^\/+/, ''))
      const response = await apiClient.post<unknown>(
        '/api/v1/dossiers/check-multi-file-path',
        { filePaths: normalizedChunk },
      )

      const payload = unwrapApiRecord<unknown>(response.data)
      const rawItems = Array.isArray(payload)
        ? payload
        : payload &&
            typeof payload === 'object' &&
            Array.isArray((payload as { items?: unknown }).items)
          ? (payload as { items: Array<unknown> }).items
          : []

      return rawItems.map((raw, index) => {
        const item =
          raw && typeof raw === 'object'
            ? (raw as Partial<CheckMultiFilePathItem>)
            : {}
        return {
          path: String(item.path ?? normalizedChunk[index] ?? ''),
          exists: Boolean(item.exists),
          fileId:
            item.fileId != null && String(item.fileId).trim()
              ? String(item.fileId)
              : null,
        }
      })
    }),
  )

  return chunkResults.flat()
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

  const entries = files.map((file) => {
    const relativePath = resolveUploadRelativePath(
      file,
      options?.storagePathPrefix,
    )
    return {
      relativePath,
      storageKey: resolveStorageKey(uploadPoint, relativePath),
    }
  })

  const checks = await checkMultiFilePath(entries.map((e) => e.storageKey))

  const conflicts = entries.filter((_, index) => checks[index]?.exists === true)

  return { conflicts, uploadPoint }
}

async function createMultiDocumentsFromStorage(
  keys: Array<string>,
  projectCode?: string,
  runMode?: OcrRunMode,
  signal?: AbortSignal,
): Promise<
  Array<{
    filePath: string
    dossierId?: string
    folderId?: string
    status?: string
    error?: string
  }>
> {
  if (keys.length === 0) return []

  const chunks: Array<Array<string>> = []
  for (let i = 0; i < keys.length; i += CREATE_MULTI_DOCUMENT_CHUNK_SIZE) {
    chunks.push(keys.slice(i, i + CREATE_MULTI_DOCUMENT_CHUNK_SIZE))
  }

  const bodyBase = {
    projectCode: toScopedProjectCode(projectCode) ?? null,
    runMode: runMode ?? 'auto',
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const normalizedChunk = chunk.map(normalizeUploadKey)
      const response = await withUploadRetry(
        async () => {
          throwIfAborted(signal)
          return await apiClient.post<unknown>(
            '/api/v1/dossiers/create-multi-document-from-storage',
            { ...bodyBase, keys: normalizedChunk },
            { _skipGlobalErrorToast: true, timeout: 0, signal },
          )
        },
        { signal },
      )

      const payload = unwrapApiRecord<unknown>(response.data)
      const rawItems = Array.isArray(payload)
        ? payload
        : payload &&
            typeof payload === 'object' &&
            Array.isArray((payload as { items?: unknown }).items)
          ? (payload as { items: Array<unknown> }).items
          : []

      return rawItems.map((raw, index) =>
        parseCreateMultiDocumentItem(raw, normalizedChunk[index] ?? ''),
      )
    }),
  )

  return chunkResults.flat()
}

function parseCreateMultiDocumentItem(
  raw: unknown,
  fallbackPath: string,
): {
  filePath: string
  dossierId?: string
  folderId?: string
  status?: string
  error?: string
} {
  if (!raw || typeof raw !== 'object') {
    return { filePath: fallbackPath }
  }

  const record = raw as Record<string, unknown>
  const filePath =
    readId(record, ['filePath', 'file_path', 'key', 'path']) ?? fallbackPath
  const dossierId = readId(record, ['dossierId', 'dossier_id'])
  const folderId = readId(record, ['folderId', 'folder_id'])
  const status =
    typeof record.status === 'string' && record.status.trim()
      ? record.status.trim()
      : undefined

  const errorRaw = record.error
  const error =
    typeof errorRaw === 'string' && errorRaw.trim()
      ? errorRaw
      : errorRaw != null && typeof errorRaw === 'object'
        ? translateError(errorRaw)
        : undefined

  return { filePath, dossierId, folderId, status, error }
}

function normalizeUploadKey(key: string): string {
  return key.replace(/^\/+/, '')
}

function matchCreateMultiItem(
  items: Array<{
    filePath: string
    dossierId?: string
    folderId?: string
    status?: string
    error?: string
  }>,
  fullKey: string,
  index: number,
):
  | {
      filePath: string
      dossierId?: string
      folderId?: string
      status?: string
      error?: string
    }
  | undefined {
  const exact = items.find((item) => item.filePath === fullKey)
  if (exact) return exact

  const normalized = normalizeUploadKey(fullKey)
  const byNormalized = items.find(
    (item) => normalizeUploadKey(item.filePath) === normalized,
  )
  if (byNormalized) return byNormalized

  return items[index]
}

function isSuccessfulCreateMultiStatus(status?: string): boolean {
  if (!status) return true
  const normalized = status.toLowerCase()
  return normalized === 'created' || normalized === 'existing'
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

function buildMinioUploadForm(
  file: File,
  uploadPoint: UploadPointResponse,
  relativePath: string,
): FormData {
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
  return form
}

async function uploadFileToMinIO(
  file: File,
  uploadPoint: UploadPointResponse,
  relativePath: string,
  signal?: AbortSignal,
): Promise<void> {
  await withUploadRetry(
    async () => {
      throwIfAborted(signal)
      const response = await fetch(uploadPoint.postURL, {
        method: 'POST',
        body: buildMinioUploadForm(file, uploadPoint, relativePath),
        signal,
      })

      if (!response.ok) {
        throw new Error(
          `Upload failed: ${response.status} ${response.statusText}`,
        )
      }
    },
    { signal },
  )
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
  tiffOnly?: boolean
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
    config?.excelOnly ||
    config?.tiffOnly
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
    config?.excelOnly ||
    config?.tiffOnly
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
  const signal = options?.signal

  throwIfAborted(signal)

  onProgress?.({
    total: files.length,
    completed: 0,
    currentFile: '',
    phase: 'preparing',
  })

  const totalPages = await sumUploadPdfPages(files, { signal })
  throwIfAborted(signal)

  const quotaCheck = await checkPageQuotaUpload(totalPages)
  if (!quotaCheck.allowed) {
    const message =
      quotaCheck.message ??
      `Không đủ hạn mức bóc tách: lượt tải có ${totalPages} trang, chỉ còn ${quotaCheck.remaining ?? 0} trang. Hãy nạp thêm license hoặc giảm số trang.`
    throw new Error(message)
  }

  throwIfAborted(signal)

  const uploadPoint =
    options?.uploadPoint ??
    (await createUploadPoint(
      computeUploadPointExpirySeconds(files.length),
      options?.runMode,
    ))

  throwIfAborted(signal)

  const prepared = files.map((file) => {
    const relativePath = resolveUploadRelativePath(
      file,
      options?.storagePathPrefix,
    )
    return {
      file,
      relativePath,
      fullKey: resolveStorageKey(uploadPoint, relativePath),
    }
  })

  const existingKeys = new Set<string>()
  if (!allowOverwrite && !skipPathCheck) {
    const checks = await checkMultiFilePath(prepared.map((p) => p.fullKey))
    for (let i = 0; i < prepared.length; i += 1) {
      if (checks[i]?.exists) {
        existingKeys.add(prepared[i]!.fullKey)
      }
    }
  }

  throwIfAborted(signal)

  const slotResults: Array<FileUploadResult | undefined> = new Array(
    files.length,
  )
  const minioPending: Array<{
    index: number
    file: File
    relativePath: string
    fullKey: string
  }> = []
  let completed = 0
  let stopClaiming = false
  let currentFile = ''

  const reportProgress = () => {
    onProgress?.({
      total: files.length,
      completed,
      currentFile,
      phase: 'uploading',
    })
  }

  reportProgress()

  try {
    await mapWithConcurrency(
      prepared,
      UPLOAD_FILE_CONCURRENCY,
      async ({ file, relativePath, fullKey }, index) => {
        throwIfAborted(signal)

        currentFile = relativePath
        reportProgress()

        let finished = false
        try {
          if (existingKeys.has(fullKey)) {
            slotResults[index] = {
              file,
              relativePath,
              status: 'skipped',
              storageKey: fullKey,
            }
          } else {
            await uploadFileToMinIO(file, uploadPoint, relativePath, signal)
            minioPending.push({ index, file, relativePath, fullKey })
          }
          finished = true
        } catch (err) {
          if (isAbortError(err)) throw err
          const error = translateError(err)
          slotResults[index] = { file, relativePath, status: 'error', error }
          finished = true
          if (isPageQuotaUploadExceededMessage(error)) {
            stopClaiming = true
          }
        } finally {
          if (finished) {
            completed += 1
            reportProgress()
          }
        }
      },
      {
        signal,
        shouldContinue: () => !stopClaiming,
      },
    )
  } catch (err) {
    if (!isAbortError(err)) throw err
  }

  if (minioPending.length > 0 && !signal?.aborted) {
    currentFile = ''
    reportProgress()

    try {
      const createdItems = await createMultiDocumentsFromStorage(
        minioPending.map((p) => p.fullKey),
        options?.projectCode,
        uploadPoint.runMode ?? options?.runMode,
        signal,
      )

      for (let i = 0; i < minioPending.length; i += 1) {
        const pending = minioPending[i]!
        const item = matchCreateMultiItem(
          createdItems,
          pending.fullKey,
          i,
        )

        if (!item) {
          slotResults[pending.index] = {
            file: pending.file,
            relativePath: pending.relativePath,
            status: 'error',
            error: 'Create document failed: missing result',
            storageKey: pending.fullKey,
          }
          continue
        }

        if (item.error || !isSuccessfulCreateMultiStatus(item.status)) {
          slotResults[pending.index] = {
            file: pending.file,
            relativePath: pending.relativePath,
            status: 'error',
            error:
              item.error ??
              (item.status
                ? `Create document failed: ${item.status}`
                : 'Create document failed: missing result'),
            storageKey: pending.fullKey,
          }
          continue
        }

        slotResults[pending.index] = {
          file: pending.file,
          relativePath: pending.relativePath,
          status: 'uploaded',
          storageKey: pending.fullKey,
          folderId: item.folderId,
          dossierId: item.dossierId,
        }
      }
    } catch (err) {
      if (!isAbortError(err)) {
        const error = translateError(err)
        for (const pending of minioPending) {
          if (slotResults[pending.index]) continue
          slotResults[pending.index] = {
            file: pending.file,
            relativePath: pending.relativePath,
            status: 'error',
            error,
            storageKey: pending.fullKey,
          }
        }
      }
    }
  }

  const results = slotResults.filter(
    (item): item is FileUploadResult => item != null,
  )

  onProgress?.({
    total: files.length,
    completed: results.length,
    currentFile: '',
    phase: 'uploading',
  })

  return { results, uploadPoint }
}
