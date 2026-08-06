import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { PageFlip } from 'page-flip/dist/js/page-flip.module.js'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useInlinePdfUrl } from '@/lib/hooks/useInlinePdfUrl'
import { cn } from '@/lib/utils/cn'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const MAX_PAGES = 200
const INITIAL_PAGES = 4
const MAX_EDGE_PX = 8192
const BASE_SCALE_FACTOR = 5
const MIN_RENDER_SCALE = 2.5

interface FlipbookViewerProps {
  fileUrl: string
  fileName?: string
  className?: string
}

function resolveDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1
  return Math.min(Math.max(window.devicePixelRatio || 1, 1), 4)
}

function resolveRenderScale(page: PDFPageProxy): number {
  const base = page.getViewport({ scale: 1 })
  const dpr = resolveDevicePixelRatio()
  const preferred = BASE_SCALE_FACTOR * dpr
  const longest = Math.max(base.width, base.height)
  if (longest <= 0) return preferred
  return Math.max(Math.min(preferred, MAX_EDGE_PX / longest), MIN_RENDER_SCALE)
}

async function renderPageToImage(page: PDFPageProxy): Promise<string> {
  const scale = resolveRenderScale(page)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D context unavailable')
  }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise
  return canvas.toDataURL('image/png')
}

async function renderPageRange(
  pdf: PDFDocumentProxy,
  fromPage: number,
  toPage: number,
  signal: AbortSignal,
): Promise<Array<string>> {
  const images: Array<string> = []
  for (let pageNumber = fromPage; pageNumber <= toPage; pageNumber += 1) {
    signal.throwIfAborted()
    const page = await pdf.getPage(pageNumber)
    try {
      images.push(await renderPageToImage(page))
    } finally {
      page.cleanup()
    }
  }
  return images
}

export function FlipbookViewer({
  fileUrl,
  fileName,
  className,
}: FlipbookViewerProps) {
  const { t } = useTranslation('archive-warehouse')
  const { displayUrl, isLoading: isUrlLoading, error: urlError } =
    useInlinePdfUrl(fileUrl)
  const hostRef = useRef<HTMLDivElement>(null)
  const pageFlipRef = useRef<PageFlip | null>(null)
  const pageImagesRef = useRef<Array<string>>([])
  const [pageImages, setPageImages] = useState<Array<string>>([])
  const [totalPages, setTotalPages] = useState(0)
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [renderError, setRenderError] = useState<Error | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [bookPageCount, setBookPageCount] = useState(0)

  pageImagesRef.current = pageImages
  const canMountBook = pageImages.length > 0

  useEffect(() => {
    if (!displayUrl) {
      setPageImages([])
      setTotalPages(0)
      setIsBootstrapping(false)
      setIsLoadingMore(false)
      setRenderError(null)
      return
    }

    const abortController = new AbortController()
    let cancelled = false
    let pdf: PDFDocumentProxy | null = null
    const loadingTask = getDocument({ url: displayUrl })

    const load = async () => {
      setIsBootstrapping(true)
      setIsLoadingMore(false)
      setRenderError(null)
      setPageImages([])
      setTotalPages(0)
      setCurrentPage(0)
      setBookPageCount(0)

      try {
        abortController.signal.throwIfAborted()
        pdf = await loadingTask.promise
        abortController.signal.throwIfAborted()

        const pageCount = Math.min(pdf.numPages, MAX_PAGES)
        setTotalPages(pageCount)

        const firstEnd = Math.min(INITIAL_PAGES, pageCount)
        const firstImages = await renderPageRange(
          pdf,
          1,
          firstEnd,
          abortController.signal,
        )
        setPageImages(firstImages)
        setIsBootstrapping(false)

        if (firstEnd >= pageCount) return

        setIsLoadingMore(true)
        const remaining = await renderPageRange(
          pdf,
          firstEnd + 1,
          pageCount,
          abortController.signal,
        )
        setPageImages((current) => [...current, ...remaining])
      } catch (err) {
        if (
          cancelled ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          return
        }
        setRenderError(err instanceof Error ? err : new Error(String(err)))
        setPageImages([])
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false)
          setIsLoadingMore(false)
        }
        try {
          await pdf?.destroy()
        } catch {
          // ignore
        }
        try {
          await loadingTask.destroy()
        } catch {
          // ignore
        }
      }
    }

    void load()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [displayUrl])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !canMountBook) return

    const bookEl = document.createElement('div')
    bookEl.className = 'h-full w-full'
    host.appendChild(bookEl)

    const pageFlip = new PageFlip(bookEl, {
      width: 700,
      height: 990,
      size: 'stretch',
      minWidth: 400,
      maxWidth: 2400,
      minHeight: 560,
      maxHeight: 2400,
      showCover: true,
      drawShadow: true,
      flippingTime: 800,
      usePortrait: true,
      mobileScrollSupport: false,
      maxShadowOpacity: 0.3,
    })

    pageFlip.loadFromImages(pageImagesRef.current)
    pageFlip.on('flip', (event) => {
      if (typeof event.data === 'number') {
        setCurrentPage(event.data)
      }
    })
    pageFlip.on('init', () => {
      setBookPageCount(pageFlip.getPageCount())
      setCurrentPage(pageFlip.getCurrentPageIndex())
    })

    pageFlipRef.current = pageFlip

    return () => {
      pageFlipRef.current = null
      try {
        pageFlip.destroy()
      } catch {
        bookEl.remove()
      }
      host.replaceChildren()
    }
  }, [displayUrl, canMountBook])

  useEffect(() => {
    const pageFlip = pageFlipRef.current
    if (!pageFlip || pageImages.length === 0) return
    pageFlip.updateFromImages(pageImages)
    setBookPageCount(pageFlip.getPageCount())
  }, [pageImages])

  const isLoading = isUrlLoading || isBootstrapping
  const error = urlError ?? renderError
  const displayedTotal = totalPages || bookPageCount || pageImages.length

  return (
    <div
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', className)}
      aria-label={fileName}
    >
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {error && !isLoading ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">{t('detail.flipbookLoadFailed')}</p>
        </div>
      ) : null}

      {!isLoading && !error && pageImages.length > 0 ? (
        <>
          <div
            ref={hostRef}
            className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/20 p-2"
          />
          <div className="flex shrink-0 items-center justify-center gap-3 border-t px-3 py-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={currentPage <= 0}
              onClick={() => pageFlipRef.current?.flipPrev()}
              aria-label={t('detail.flipbookPrev')}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
              {t('detail.flipbookPage', {
                current: currentPage + 1,
                total: displayedTotal,
              })}
              {isLoadingMore ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : null}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                bookPageCount > 0 && currentPage >= bookPageCount - 1
              }
              onClick={() => pageFlipRef.current?.flipNext()}
              aria-label={t('detail.flipbookNext')}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
