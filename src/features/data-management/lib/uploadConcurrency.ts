export const UPLOAD_FILE_CONCURRENCY = 4
export const PDF_PAGE_COUNT_CONCURRENCY = 3
export const UPLOAD_RETRY_ATTEMPTS = 3
export const UPLOAD_RETRY_BASE_DELAY_MS = 500

export async function mapWithConcurrency<T, R>(
  items: Array<T>,
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  options?: {
    signal?: AbortSignal
    shouldContinue?: () => boolean
  },
): Promise<Array<R>> {
  if (items.length === 0) return []

  const results: Array<R> = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (true) {
      if (options?.signal?.aborted) {
        throw options.signal.reason instanceof Error
          ? options.signal.reason
          : new DOMException('Upload aborted', 'AbortError')
      }
      if (options?.shouldContinue && !options.shouldContinue()) {
        return
      }

      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) return

      results[index] = await mapper(items[index]!, index)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw signal.reason instanceof Error
    ? signal.reason
    : new DOMException('Upload aborted', 'AbortError')
}

export function isAbortError(error: unknown): boolean {
  if (!error) return false
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (error instanceof Error && error.name === 'AbortError') return true
  if (
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ERR_CANCELED'
  ) {
    return true
  }
  return false
}

export function isRetryableUploadError(error: unknown): boolean {
  if (isAbortError(error)) return false

  if (error instanceof TypeError) return true

  if (typeof error === 'object' && error !== null) {
    const status = (error as { response?: { status?: number }; status?: number })
      .response?.status ?? (error as { status?: number }).status
    if (typeof status === 'number') {
      return status === 408 || status === 429 || status >= 500
    }
    const code = (error as { code?: string }).code
    if (
      code === 'ECONNABORTED' ||
      code === 'ERR_NETWORK' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET'
    ) {
      return true
    }
  }

  const message = error instanceof Error ? error.message : String(error ?? '')
  const statusMatch = /Upload failed:\s*(\d+)/i.exec(message)
  if (statusMatch) {
    const status = Number(statusMatch[1])
    return status === 408 || status === 429 || status >= 500
  }

  return /network|timeout|failed to fetch|load failed/i.test(message)
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException('Upload aborted', 'AbortError'),
      )
      return
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    function onAbort() {
      clearTimeout(timer)
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new DOMException('Upload aborted', 'AbortError'),
      )
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export async function withUploadRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options?: {
    signal?: AbortSignal
    attempts?: number
    baseDelayMs?: number
  },
): Promise<T> {
  const attempts = options?.attempts ?? UPLOAD_RETRY_ATTEMPTS
  const baseDelayMs = options?.baseDelayMs ?? UPLOAD_RETRY_BASE_DELAY_MS
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    throwIfAborted(options?.signal)
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error
      if (
        attempt >= attempts ||
        !isRetryableUploadError(error) ||
        options?.signal?.aborted
      ) {
        throw error
      }
      await delay(baseDelayMs * 2 ** (attempt - 1), options?.signal)
    }
  }

  throw lastError
}
