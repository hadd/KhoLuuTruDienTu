import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Document, Page, pdfjs } from 'react-pdf'

import { useInlinePdfUrl } from '@/lib/hooks/useInlinePdfUrl'
import { cn } from '@/lib/utils/cn'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const FALLBACK_WIDTH = 400

export interface PdfFieldHighlight {
  page: number
  bbox: [number, number, number, number]
}

interface PageMetrics {
  originalWidth: number
  originalHeight: number
  renderWidth: number
  renderHeight: number
}

interface PdfViewerProps {
  fileUrl: string
  fileName?: string
  className?: string
  showBorder?: boolean
  fixedHeight?: number
  highlight?: PdfFieldHighlight | null
}

function PdfBboxHighlight({
  bbox,
  metrics,
}: {
  bbox: [number, number, number, number]
  metrics: PageMetrics
}) {
  const [x1, y1, x2, y2] = bbox
  if (x2 <= x1 || y2 <= y1) return null

  const { originalWidth, originalHeight, renderWidth, renderHeight } = metrics
  const scaleX = renderWidth / originalWidth
  const scaleY = renderHeight / originalHeight

  return (
    <div
      className="pointer-events-none absolute z-10 rounded-sm border-2 border-primary bg-primary/25 shadow-sm"
      style={{
        left: x1 * scaleX,
        top: y1 * scaleY,
        width: (x2 - x1) * scaleX,
        height: (y2 - y1) * scaleY,
      }}
      aria-hidden
    />
  )
}

export function PdfViewer({
  fileUrl,
  fileName: _fileName,
  className,
  showBorder = true,
  fixedHeight,
  highlight = null,
}: PdfViewerProps) {
  const { t } = useTranslation('common')
  const containerRef = useRef<HTMLDivElement>(null)
  const pageWrapperRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [containerWidth, setContainerWidth] = useState(FALLBACK_WIDTH)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [documentError, setDocumentError] = useState<Error | null>(null)
  const [pageMetrics, setPageMetrics] = useState<Map<number, PageMetrics>>(
    () => new Map(),
  )

  const {
    displayUrl,
    isLoading: isUrlLoading,
    error: urlError,
  } = useInlinePdfUrl(fileUrl || null)

  const effectiveFileUrl = displayUrl ?? fileUrl
  const fixedHeightStyle = fixedHeight
    ? { height: fixedHeight, maxHeight: fixedHeight, minHeight: fixedHeight }
    : undefined

  useEffect(() => {
    setNumPages(null)
    setDocumentError(null)
    setPageMetrics(new Map())
    pageWrapperRefs.current.clear()
  }, [effectiveFileUrl])

  useEffect(() => {
    if (!highlight?.page) return
    const pageEl = pageWrapperRefs.current.get(highlight.page)
    pageEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlight])

  const isViewerMounted = Boolean(fileUrl && !isUrlLoading && !urlError)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const applyWidth = (width: number) => {
      if (width > 0) setContainerWidth(width)
    }

    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width ?? el.clientWidth
      applyWidth(width)
    })
    ro.observe(el)
    applyWidth(el.clientWidth)
    const rafId = requestAnimationFrame(() => applyWidth(el.clientWidth))
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [isViewerMounted])

  function handlePageLoadSuccess(pageNumber: number, page: PDFPageProxy) {
    const viewport = page.getViewport({ scale: 1 })
    const scale = pageWidth / viewport.width
    setPageMetrics((prev) => {
      const next = new Map(prev)
      next.set(pageNumber, {
        originalWidth: viewport.width,
        originalHeight: viewport.height,
        renderWidth: pageWidth,
        renderHeight: viewport.height * scale,
      })
      return next
    })
  }

  function renderErrorNode(
    titleKey: 'rightPanel.pdfViewer.loadError' | 'rightPanel.pdfViewer.renderError',
    detail?: string,
  ) {
    return (
      <div
        className={cn(
          'flex h-full flex-col items-center justify-center gap-2 rounded-lg bg-background p-4 text-center',
          showBorder && 'border border-border',
          fixedHeight ? 'min-h-0' : 'min-h-[400px]',
        )}
      >
        <p className="text-sm font-medium text-foreground">{t(titleKey)}</p>
        {detail ? (
          <p className="max-w-sm text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    )
  }

  if (!fileUrl) {
    return (
      <div
        className={cn('flex w-full min-w-0 flex-col', className)}
        style={fixedHeightStyle}
      >
        <div
          className={cn(
            'flex flex-1 items-center justify-center rounded-lg bg-background p-4',
            showBorder && 'border border-border',
            fixedHeight ? 'min-h-0' : 'min-h-[400px]',
          )}
        >
          <p className="text-sm text-muted-foreground">
            {t('rightPanel.pdfViewer.noFile')}
          </p>
        </div>
      </div>
    )
  }

  const loadingNode = (
    <div
      className={cn(
        'flex h-full items-center justify-center rounded-lg bg-background p-4',
        showBorder && 'border border-border',
        fixedHeight ? 'min-h-0' : 'min-h-[400px]',
      )}
    >
      <p className="text-sm text-muted-foreground">
        {t('rightPanel.pdfViewer.loading')}
      </p>
    </div>
  )

  if (isUrlLoading || (!urlError && !displayUrl)) {
    return (
      <div
        className={cn('flex w-full min-w-0 flex-col', className)}
        style={fixedHeightStyle}
      >
        <div
          className={cn(
            'flex flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-lg bg-background',
            showBorder && 'border border-border',
          )}
        >
          {loadingNode}
        </div>
      </div>
    )
  }

  if (urlError) {
    return (
      <div
        className={cn('flex w-full min-w-0 flex-col', className)}
        style={fixedHeightStyle}
      >
        <div
          className={cn(
            'flex flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-lg bg-background',
            showBorder && 'border border-border',
          )}
        >
          {renderErrorNode('rightPanel.pdfViewer.loadError', urlError.message)}
        </div>
      </div>
    )
  }

  if (documentError) {
    return (
      <div
        className={cn('flex w-full min-w-0 flex-col', className)}
        style={fixedHeightStyle}
      >
        <div
          className={cn(
            'flex flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-lg bg-background',
            showBorder && 'border border-border',
          )}
        >
          {renderErrorNode(
            'rightPanel.pdfViewer.renderError',
            documentError.message,
          )}
        </div>
      </div>
    )
  }

  function onDocumentLoadSuccess({ numPages: total }: { numPages: number }) {
    setDocumentError(null)
    setNumPages(total)
  }

  function onDocumentLoadError(error: Error) {
    console.error('[PdfViewer] Document load failed:', error)
    setDocumentError(error)
    setNumPages(null)
  }

  const pageWidth = Math.max(containerWidth - 16, 1)
  const errorNode = renderErrorNode('rightPanel.pdfViewer.renderError')

  return (
    <div
      className={cn('flex w-full min-w-0 flex-col', className)}
      style={fixedHeightStyle}
    >
      <div
        ref={containerRef}
        className={cn(
          'flex-1 min-h-0 min-w-0 w-full overflow-y-auto overflow-x-hidden rounded-lg bg-background',
          showBorder && 'border border-border',
        )}
      >
        <Document
          file={effectiveFileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={loadingNode}
          error={errorNode}
        >
          {numPages !== null &&
            Array.from({ length: numPages }, (_, index) => {
              const pageNumber = index + 1
              const metrics = pageMetrics.get(pageNumber)
              const showHighlight = highlight?.page === pageNumber && metrics

              return (
                <div
                  key={pageNumber}
                  ref={(element) => {
                    if (element) {
                      pageWrapperRefs.current.set(pageNumber, element)
                    } else {
                      pageWrapperRefs.current.delete(pageNumber)
                    }
                  }}
                  className="flex justify-center p-2"
                >
                  <div className="relative inline-block">
                    <Page
                      pageNumber={pageNumber}
                      width={pageWidth}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      canvasBackground="white"
                      onLoadSuccess={(page) =>
                        handlePageLoadSuccess(pageNumber, page)
                      }
                    />
                    {showHighlight ? (
                      <PdfBboxHighlight
                        bbox={highlight.bbox}
                        metrics={metrics}
                      />
                    ) : null}
                  </div>
                </div>
              )
            })}
        </Document>
      </div>
    </div>
  )
}
