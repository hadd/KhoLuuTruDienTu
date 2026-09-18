import {
  ensureFreshAccessToken,
  AuthenticationError,
} from '@/lib/api/apiClient'
import {
  buildSecurityAccessHeaders,
  type SecurityAccessModule,
} from '@/features/security-level/lib/securityAccessTokenStore'
import { notifyZipPasswordLocked } from '@/features/security-level/lib/zipPasswordToast'
import { env } from '@/lib/utils/env'

/** ~10000 phút — export cây lớn có thể stream rất lâu. */
const EXPORT_TIMEOUT_MS = 10_000 * 60 * 1000

export type StreamDownloadOptions = {
  method?: 'GET' | 'POST'
  path: string
  body?: unknown
  fallbackFileName: string
  params?: Record<string, string | boolean | undefined>
  dossierId?: string | null
  securityAccessModule?: SecurityAccessModule | null
  timeoutMs?: number
}

function resolveDownloadFileName(
  contentDisposition: string | null,
  fallbackName: string,
): string {
  if (!contentDisposition) return fallbackName

  const match = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(contentDisposition)
  if (!match?.[1]) return fallbackName

  return decodeURIComponent(match[1].replace(/"/g, ''))
}

function normalizeZipFileName(fileName: string): string {
  if (/\.zip$/i.test(fileName)) return fileName
  const base = fileName.replace(/\.xlsx?$/i, '').replace(/\.+$/, '')
  return base ? `${base}.zip` : 'export.zip'
}

function headersToRecord(headers: Headers): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

function buildUrl(
  path: string,
  params?: Record<string, string | boolean | undefined>,
): string {
  const base = env.API_URL.replace(/\/$/, '')
  const url = new URL(path.startsWith('http') ? path : `${base}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      message?: unknown
      error?: unknown
    }
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error.trim()
    }
    if (data.error && typeof data.error === 'object') {
      const rec = data.error as { message?: unknown }
      if (typeof rec.message === 'string' && rec.message.trim()) {
        return rec.message.trim()
      }
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim()
    }
  } catch {
    // ignore
  }
  return `Download failed: ${response.status} ${response.statusText}`
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
  }) => Promise<FileSystemFileHandle>
}

async function tryOpenSaveFileHandle(
  suggestedName: string,
): Promise<FileSystemFileHandle | null> {
  const w = window as SaveFilePickerWindow
  if (typeof w.showSaveFilePicker !== 'function') return null
  try {
    return await w.showSaveFilePicker({
      suggestedName: normalizeZipFileName(suggestedName),
      types: [
        {
          description: 'ZIP archive',
          accept: { 'application/zip': ['.zip'] },
        },
      ],
    })
  } catch (err) {
    // User cancelled the picker — abort the whole export.
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    // Other picker failures (permission, insecure context) → blob fallback.
    return null
  }
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

/**
 * Download a large ZIP via fetch streaming.
 * Prefer File System Access (`showSaveFilePicker`) so the file is written to disk
 * without holding the whole archive in browser heap. Falls back to a single Blob
 * (no `new Blob([data])` copy) when the picker is unavailable.
 *
 * Call this from a user-gesture handler so the save picker can open.
 */
export async function streamDownloadToDisk(
  options: StreamDownloadOptions,
): Promise<void> {
  const fileHandle = await tryOpenSaveFileHandle(options.fallbackFileName)

  const token = await ensureFreshAccessToken()
  const headers: Record<string, string> = {
    Accept: 'application/zip, application/octet-stream, */*',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const securityHeaders = buildSecurityAccessHeaders({
    module: options.securityAccessModule,
    dossierId: options.dossierId,
  })
  Object.assign(headers, securityHeaders)

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? EXPORT_TIMEOUT_MS
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(buildUrl(options.path, options.params), {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
      signal: controller.signal,
    })
  } catch (err) {
    window.clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.')
    }
    throw err
  }

  if (response.status === 401) {
    window.clearTimeout(timeoutId)
    // One refresh + retry
    const newToken = await ensureFreshAccessToken()
    if (!newToken) {
      throw new AuthenticationError(
        'Authentication failed. Please login again.',
      )
    }
    headers.Authorization = `Bearer ${newToken}`
    try {
      response = await fetch(buildUrl(options.path, options.params), {
        method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
        headers,
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
        credentials: 'include',
        signal: controller.signal,
      })
    } catch (err) {
      window.clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.')
      }
      throw err
    }
  }

  if (!response.ok) {
    window.clearTimeout(timeoutId)
    throw new Error(await parseErrorMessage(response))
  }

  const fileName = normalizeZipFileName(
    resolveDownloadFileName(
      response.headers.get('content-disposition'),
      options.fallbackFileName,
    ),
  )

  try {
    if (fileHandle && response.body) {
      const writable = await fileHandle.createWritable()
      try {
        await response.body.pipeTo(writable)
      } catch (err) {
        try {
          await writable.abort()
        } catch {
          // ignore
        }
        throw err
      }
    } else {
      // Fallback: one Blob in memory (still no double-copy via new Blob([data])).
      const blob = await response.blob()
      triggerBlobDownload(blob, fileName)
    }
    notifyZipPasswordLocked(headersToRecord(response.headers))
  } finally {
    window.clearTimeout(timeoutId)
  }
}
