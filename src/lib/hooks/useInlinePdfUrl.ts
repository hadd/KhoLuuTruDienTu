import { useEffect, useRef, useState } from 'react'

import { apiClient } from '@/lib/api/apiClient'
import { env } from '@/lib/utils/env'

export interface UseInlinePdfUrlResult {
  displayUrl: string | null
  isLoading: boolean
  error: Error | null
}

function resolveApiPath(url: string): string | null {
  if (url.startsWith('/')) return url
  if (env.API_URL && url.startsWith(env.API_URL)) {
    return url.slice(env.API_URL.length)
  }
  return null
}

async function validatePdfBlob(rawBlob: Blob): Promise<Blob> {
  const header = new Uint8Array(await rawBlob.slice(0, 5).arrayBuffer())
  const isPdf =
    header.length >= 4 &&
    header[0] === 0x25 &&
    header[1] === 0x50 &&
    header[2] === 0x44 &&
    header[3] === 0x46

  if (!isPdf) {
    throw new Error('Invalid PDF response')
  }

  return new Blob([rawBlob], { type: 'application/pdf' })
}

async function fetchPdfBlob(url: string): Promise<Blob> {
  const apiPath = resolveApiPath(url)

  if (apiPath) {
    const response = await apiClient.get<Blob>(apiPath, {
      responseType: 'blob',
      _skipGlobalErrorToast: true,
    })
    return validatePdfBlob(response.data)
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return validatePdfBlob(await response.blob())
}

/**
 * Fetches a PDF URL (e.g. S3 presigned or API path) and returns a blob URL so the browser
 * displays it inline instead of triggering download (avoids Content-Disposition: attachment).
 * Revokes the blob URL on unmount or when fileUrl changes.
 */
export function useInlinePdfUrl(
  fileUrl: string | null | undefined,
): UseInlinePdfUrlResult {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!fileUrl || fileUrl.trim() === '') {
      setDisplayUrl(null)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const pdfBlob = await fetchPdfBlob(fileUrl)
        if (cancelled) return
        const blobUrl = URL.createObjectURL(pdfBlob)
        blobUrlRef.current = blobUrl
        setDisplayUrl(blobUrl)
      } catch (err) {
        const nextError = err instanceof Error ? err : new Error(String(err))
        console.error('[PdfViewer] Failed to fetch PDF:', nextError, { fileUrl })
        if (!cancelled) {
          setError(nextError)
          setDisplayUrl(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      setDisplayUrl(null)
    }
  }, [fileUrl])

  return { displayUrl, isLoading, error }
}
