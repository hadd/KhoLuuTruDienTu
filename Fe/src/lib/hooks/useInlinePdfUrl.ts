import { useEffect, useRef, useState } from 'react'

export interface UseInlinePdfUrlResult {
  displayUrl: string | null
  isLoading: boolean
  error: Error | null
}

/**
 * Fetches a PDF URL (e.g. S3 presigned) and returns a blob URL so the browser
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
        const response = await fetch(fileUrl)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const rawBlob = await response.blob()
        if (cancelled) return
        // Force application/pdf so the browser renders inline even if S3 returns a different Content-Type
        const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' })
        const blobUrl = URL.createObjectURL(pdfBlob)
        blobUrlRef.current = blobUrl
        setDisplayUrl(blobUrl)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
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
