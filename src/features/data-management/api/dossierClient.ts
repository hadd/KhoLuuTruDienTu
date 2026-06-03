import { apiClient } from '@/lib/api/apiClient'

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
}

export interface UploadProgress {
  total: number
  completed: number
  currentFile: string
  phase: 'preparing' | 'uploading'
}

async function createUploadPoint(): Promise<UploadPointResponse> {
  const response = await apiClient.post<UploadPointResponse>(
    '/api/v1/dossiers/create-upload-point',
    {
      prefix: '/raw',
      expiry: 60,
      maxFileSize: 10485760,
      contentTypePrefix: '',
    },
  )
  return response.data
}

async function checkFilePath(filePath: string): Promise<boolean> {
  const response = await apiClient.get<{ exists: boolean }>(
    `/api/v1/dossiers/check-file-path?filePath=${encodeURIComponent(filePath)}`,
  )
  return response.data.exists
}

async function createDocumentFromStorage(key: string): Promise<{
  folderId?: string
  dossierId?: string
}> {
  const response = await apiClient.post<Record<string, unknown>>(
    '/api/v1/dossiers/create-document-from-storage',
    { key },
  )

  const data = response.data
  const record =
    data.record && typeof data.record === 'object'
      ? (data.record as Record<string, unknown>)
      : data

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
  const baseKey = uploadPoint.prefix.endsWith('/')
    ? uploadPoint.prefix
    : `${uploadPoint.prefix}/`

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

  const fileName = normalizeMetadataExportFileName(
    resolveDownloadFileName(
      response.headers['content-disposition'],
      fallbackName,
    ),
  )

  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function exportDossierMetadataExcel(
  dossierId: string,
  downloadName?: string,
): Promise<void> {
  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}.zip`
    : `dossier-${dossierId}.zip`
  await downloadMetadataExport(
    `/api/v1/dossiers/${encodeURIComponent(dossierId)}/metadata/export`,
    fallbackName,
  )
}

export async function exportFolderMetadataExcel(
  folderId: string,
  downloadName?: string,
): Promise<void> {
  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}.zip`
    : `folder-${folderId}.zip`
  await downloadMetadataExport(
    `/api/v1/folders/${encodeURIComponent(folderId)}/metadata/export`,
    fallbackName,
  )
}

export async function uploadFolderFiles(
  files: Array<File>,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadFolderResult> {
  onProgress?.({
    total: files.length,
    completed: 0,
    currentFile: '',
    phase: 'preparing',
  })

  const uploadPoint = await createUploadPoint()

  const baseKey = uploadPoint.prefix.endsWith('/')
    ? uploadPoint.prefix
    : `${uploadPoint.prefix}/`

  const results: Array<FileUploadResult> = []

  for (const [index, file] of files.entries()) {
    const relativePath = file.webkitRelativePath || file.name
    const fullKey = baseKey + relativePath

    onProgress?.({
      total: files.length,
      completed: index,
      currentFile: relativePath,
      phase: 'uploading',
    })

    try {
      const exists = await checkFilePath(fullKey)

      if (exists) {
        results.push({ file, relativePath, status: 'skipped', storageKey: fullKey })
      } else {
        await uploadFileToMinIO(file, uploadPoint, relativePath)
        const created = await createDocumentFromStorage(fullKey)
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

  return { results }
}
