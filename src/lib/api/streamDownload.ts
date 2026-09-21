import {
  ensureFreshAccessToken,
  AuthenticationError,
} from '@/lib/api/apiClient'
import { buildSecurityAccessHeaders } from '@/features/security-level/lib/securityAccessTokenStore'
import type { SecurityAccessModule } from '@/features/security-level/lib/securityAccessTokenStore'
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

type ExportDownloadTicketResponse = {
  id: string
  downloadUrl: string
  statusUrl: string
  expiresAt: number
}

type ExportDownloadStatus = {
  id: string
  state: 'pending' | 'started' | 'completed' | 'failed'
  statusCode?: number
  errorMessage?: string
  zipPasswordSource?: 'personal_pin' | 'dossier' | 'none'
  createdAt: number
  consumedAt?: number
  expiresAt: number
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

function buildRelativeRequestPath(
  path: string,
  params?: Record<string, string | boolean | undefined>,
): string {
  const absolute = buildUrl(path, params)
  const url = new URL(absolute)
  return `${url.pathname}${url.search}`
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
      accept: Record<string, Array<string>>
    }>
  }) => Promise<FileSystemFileHandle>
}

type AuthenticatedJsonRequest = {
  path: string
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: unknown
  signal: AbortSignal
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

function createNativeDownloadFrame(downloadUrl: string): HTMLIFrameElement {
  const frame = document.createElement('iframe')
  frame.hidden = true
  frame.setAttribute('aria-hidden', 'true')
  frame.src = downloadUrl
  document.body.appendChild(frame)
  return frame
}

function cleanupNativeDownloadFrame(frame: HTMLIFrameElement) {
  window.setTimeout(() => {
    frame.remove()
  }, 30_000)
}

function buildDownloadHeaders(
  options: StreamDownloadOptions,
  token: string | null,
): Record<string, string> {
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
  return headers
}

async function fetchJsonWithAuth(
  input: AuthenticatedJsonRequest,
): Promise<Response> {
  const requestUrl = buildUrl(input.path)
  const send = async (token: string | null): Promise<Response> => {
    const headers = { ...(input.headers ?? {}) }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    } else {
      delete headers.Authorization
    }
    if (input.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
    }
    return await fetch(requestUrl, {
      method: input.method,
      headers,
      body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
      credentials: 'include',
      signal: input.signal,
    })
  }

  let token = await ensureFreshAccessToken()
  let response = await send(token)
  if (response.status !== 401) return response

  token = await ensureFreshAccessToken()
  if (!token) {
    throw new AuthenticationError('Authentication failed. Please login again.')
  }
  response = await send(token)
  return response
}

function abortAwareSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      window.clearTimeout(timeoutId)
      signal.removeEventListener('abort', onAbort)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function createExportDownloadTicket(
  requestPath: string,
  method: 'GET' | 'POST',
  body: unknown,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<ExportDownloadTicketResponse> {
  const response = await fetchJsonWithAuth({
    path: '/api/v1/export-downloads',
    method: 'POST',
    headers,
    body: {
      method,
      path: requestPath,
      ...(body !== undefined ? { body } : {}),
    },
    signal,
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return (await response.json()) as ExportDownloadTicketResponse
}

async function waitForExportDownloadCompletion(
  statusPath: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<ExportDownloadStatus> {
  while (true) {
    const response = await fetchJsonWithAuth({
      path: statusPath,
      method: 'GET',
      headers,
      signal,
    })
    if (!response.ok) {
      throw new Error(await parseErrorMessage(response))
    }
    const status = (await response.json()) as ExportDownloadStatus
    if (status.state === 'completed') {
      return status
    }
    if (status.state === 'failed') {
      throw new Error(
        status.errorMessage?.trim() ||
          `Download failed${status.statusCode ? `: ${status.statusCode}` : ''}`,
      )
    }
    await abortAwareSleep(1500, signal)
  }
}

async function startNativeExportDownload(
  options: StreamDownloadOptions,
  requestPath: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<void> {
  const ticket = await createExportDownloadTicket(
    requestPath,
    options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    options.body,
    headers,
    signal,
  )
  const frame = createNativeDownloadFrame(buildUrl(ticket.downloadUrl))
  try {
    const status = await waitForExportDownloadCompletion(
      ticket.statusUrl,
      headers,
      signal,
    )
    notifyZipPasswordLocked({
      'x-zip-password-source': status.zipPasswordSource ?? 'none',
    })
  } finally {
    cleanupNativeDownloadFrame(frame)
  }
}

/**
 * Download a large ZIP via fetch streaming.
 * Prefer File System Access (`showSaveFilePicker`) so the file is written to disk
 * without holding the whole archive in browser heap. When unavailable, create a
 * short-lived ticket and let the browser handle a native download instead of
 * buffering the full ZIP in JS memory.
 *
 * Call this from a user-gesture handler so the save picker can open.
 */
export async function streamDownloadToDisk(
  options: StreamDownloadOptions,
): Promise<void> {
  const fileHandle = await tryOpenSaveFileHandle(options.fallbackFileName)
  const requestPath = buildRelativeRequestPath(options.path, options.params)

  const token = await ensureFreshAccessToken()
  const headers = buildDownloadHeaders(options, token)

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? EXPORT_TIMEOUT_MS
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  if (!fileHandle) {
    try {
      await startNativeExportDownload(
        options,
        requestPath,
        headers,
        controller.signal,
      )
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.')
      }
      throw err
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  let response: Response
  try {
    response = await fetch(buildUrl(requestPath), {
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
      response = await fetch(buildUrl(requestPath), {
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

  try {
    if (response.body) {
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
      throw new Error('Streaming response unavailable. Please try again.')
    }
    notifyZipPasswordLocked(headersToRecord(response.headers))
  } finally {
    window.clearTimeout(timeoutId)
  }
}
