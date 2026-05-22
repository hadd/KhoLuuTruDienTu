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
}

export interface UploadFolderResult {
  results: FileUploadResult[]
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

async function createDocumentFromStorage(key: string): Promise<void> {
  await apiClient.post('/api/v1/dossiers/create-document-from-storage', { key })
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

export async function uploadFolderFiles(
  files: Array<File>,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadFolderResult> {
  onProgress?.({ total: files.length, completed: 0, currentFile: '', phase: 'preparing' })

  const uploadPoint = await createUploadPoint()

  const baseKey = uploadPoint.prefix.endsWith('/')
    ? uploadPoint.prefix
    : `${uploadPoint.prefix}/`

  const results: FileUploadResult[] = []

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
        results.push({ file, relativePath, status: 'skipped' })
      } else {
        await uploadFileToMinIO(file, uploadPoint, relativePath)
        await createDocumentFromStorage(fullKey)
        results.push({ file, relativePath, status: 'uploaded' })
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
