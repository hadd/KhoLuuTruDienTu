import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Document, Page, pdfjs } from 'react-pdf'

import { PdfPageMaskOverlay } from '@/components/common/PdfPageMaskOverlay'
import { useInlinePdfUrl } from '@/lib/hooks/useInlinePdfUrl'
import { cn } from '@/lib/utils/cn'
import {
  computeOcrRasterPageSize,
  computeRasterPageSizeFromDpi,
  inferOcrDpiFromEmbeddedImage,
  mapBboxToRenderRect,
  mapBboxToRenderRectViaImagePlacement,
  pdfImageBBoxToRenderRect,
  pickOcrPixelSize,
  resolveSourcePageSize,
  type BboxPageMetrics,
  type BboxTuple,
  type RenderRect,
  type SourcePageSize,
} from '@/features/data-management/lib/bboxCoords'
import { extractPageImageSizes } from '@/features/data-management/lib/pdfPageRaster'
import type { PdfImagePlacement } from '@/features/data-management/lib/pdfPageRaster'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const FALLBACK_WIDTH = 400

export interface PdfFieldHighlight {
  page: number
  bboxes: Array<BboxTuple>
  sourcePageWidth?: number
  sourcePageHeight?: number
  /** All bboxes on the same page — used to infer raster page dimensions */
  referenceBboxes?: Array<BboxTuple>
}

export interface PdfBboxRevealRegion {
  page: number
  bboxes: Array<BboxTuple>
  sourcePageWidth?: number
  sourcePageHeight?: number
  /** All bboxes on the same page — used to infer raster page dimensions */
  referenceBboxes?: Array<BboxTuple>
}

interface PageMetrics extends BboxPageMetrics {
  fullPageImageSize?: SourcePageSize | null
  dpiInferenceImageSize?: SourcePageSize | null
  fullPageImagePlacement?: PdfImagePlacement | null
}

interface PdfViewerProps {
  fileUrl: string
  fileName?: string
  className?: string
  showBorder?: boolean
  fixedHeight?: number
  highlight?: PdfFieldHighlight | null
  maskMode?: 'off' | 'bbox-only'
  revealRegions?: Array<PdfBboxRevealRegion>
  renderTextLayer?: boolean
  renderAnnotationLayer?: boolean
}

function resolveHighlightRenderRect(
  bbox: BboxTuple,
  metrics: PageMetrics,
  highlight: PdfFieldHighlight,
  inferBboxes: Array<BboxTuple>,
): RenderRect | null {
  const imagePlacement = metrics.fullPageImagePlacement
  const ocrRaster = computeOcrRasterPageSize(
    metrics.originalWidth,
    metrics.originalHeight,
  )
  const dpiInferred =
    metrics.dpiInferenceImageSize &&
    metrics.dpiInferenceImageSize.width > 0 &&
    metrics.dpiInferenceImageSize.height > 0
      ? computeRasterPageSizeFromDpi(
          metrics,
          inferOcrDpiFromEmbeddedImage(
            metrics.dpiInferenceImageSize,
            metrics,
          ),
        )
      : null

  const ocrPixelSize = pickOcrPixelSize(
    inferBboxes,
    {
      api:
        highlight.sourcePageWidth && highlight.sourcePageHeight
          ? {
              width: highlight.sourcePageWidth,
              height: highlight.sourcePageHeight,
            }
          : null,
      ocrRaster,
      embedded: metrics.fullPageImageSize,
      dpiInferred,
    },
    metrics,
  )

  if (imagePlacement && ocrPixelSize) {
    const imageRenderRect = pdfImageBBoxToRenderRect(
      imagePlacement.pdfBBox,
      metrics,
    )
    return mapBboxToRenderRectViaImagePlacement(
      bbox,
      ocrPixelSize,
      imageRenderRect,
    )
  }

  const sourcePageSize = resolveSourcePageSize(inferBboxes, metrics, {
    width: highlight.sourcePageWidth,
    height: highlight.sourcePageHeight,
    embeddedImageSize: metrics.fullPageImageSize,
    dpiInferenceImageSize: metrics.dpiInferenceImageSize,
  })

  return mapBboxToRenderRect(bbox, metrics, sourcePageSize)
}

function scrollHighlightIntoView(
  container: HTMLDivElement,
  pageWrapper: HTMLDivElement,
  pageCanvasHost: HTMLDivElement | null,
  highlight: PdfFieldHighlight,
  metrics: PageMetrics,
): void {
  const inferBboxes = highlight.referenceBboxes ?? highlight.bboxes
  const primaryBbox = highlight.bboxes[0]

  if (!primaryBbox) {
    pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  const rect = resolveHighlightRenderRect(
    primaryBbox,
    metrics,
    highlight,
    inferBboxes,
  )

  if (!rect || !pageCanvasHost) {
    pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  const containerRect = container.getBoundingClientRect()
  const hostRect = pageCanvasHost.getBoundingClientRect()
  const bboxCenterY = hostRect.top + rect.top + rect.height / 2
  const targetScrollTop =
    container.scrollTop +
    (bboxCenterY - containerRect.top) -
    containerRect.height / 2

  container.scrollTo({
    top: Math.max(0, targetScrollTop),
    behavior: 'smooth',
  })
}

function PdfBboxHighlight({
  bbox,
  metrics,
  highlight,
  inferBboxes,
}: {
  bbox: BboxTuple
  metrics: PageMetrics
  highlight: PdfFieldHighlight
  inferBboxes: Array<BboxTuple>
}) {
  const rect = resolveHighlightRenderRect(
    bbox,
    metrics,
    highlight,
    inferBboxes,
  )
  if (!rect) return null

  return (
    <div
      className="pointer-events-none absolute z-30 rounded-sm border-2 border-primary bg-primary/25 shadow-sm"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
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
  maskMode = 'off',
  revealRegions = [],
  renderTextLayer = true,
  renderAnnotationLayer = true,
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
  const maskIdPrefix = useId()
  const pageCanvasHostRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [pageRenderVersions, setPageRenderVersions] = useState<
    Map<number, number>
  >(() => new Map())

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
    setPageRenderVersions(new Map())
    pageWrapperRefs.current.clear()
    pageCanvasHostRefs.current.clear()
  }, [effectiveFileUrl])

  const revealRectsByPage = useMemo(() => {
    const mapped = new Map<number, Array<RenderRect>>()
    if (maskMode !== 'bbox-only') return mapped

    revealRegions.forEach((region) => {
      const metrics = pageMetrics.get(region.page)
      if (!metrics) return

      const inferBboxes = region.referenceBboxes ?? region.bboxes
      const regionHighlight: PdfFieldHighlight = {
        page: region.page,
        bboxes: region.bboxes,
        sourcePageWidth: region.sourcePageWidth,
        sourcePageHeight: region.sourcePageHeight,
        referenceBboxes: region.referenceBboxes,
      }
      const nextRects = region.bboxes
        .map((bbox) =>
          resolveHighlightRenderRect(
            bbox,
            metrics,
            regionHighlight,
            inferBboxes,
          ),
        )
        .filter((rect): rect is RenderRect => Boolean(rect))

      if (nextRects.length === 0) return
      const existing = mapped.get(region.page) ?? []
      mapped.set(region.page, [...existing, ...nextRects])
    })

    return mapped
  }, [maskMode, pageMetrics, revealRegions])

  const isViewerMounted = Boolean(fileUrl && !isUrlLoading && !urlError)
  const pageWidth = Math.max(containerWidth - 16, 1)
  const highlightPageMetrics = highlight?.page
    ? pageMetrics.get(highlight.page)
    : undefined

  useEffect(() => {
    if (!highlight?.page) return

    const container = containerRef.current
    const pageWrapper = pageWrapperRefs.current.get(highlight.page)
    if (!container || !pageWrapper) return

    const pageCanvasHost = pageCanvasHostRefs.current.get(highlight.page) ?? null
    const metrics = pageMetrics.get(highlight.page)

    if (metrics) {
      scrollHighlightIntoView(
        container,
        pageWrapper,
        pageCanvasHost,
        highlight,
        metrics,
      )
      return
    }

    pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlight, highlightPageMetrics, pageWidth])

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

  useEffect(() => {
    setPageMetrics((prev) => {
      if (prev.size === 0) return prev

      const next = new Map(prev)
      next.forEach((metrics, pageNumber) => {
        const scale = pageWidth / metrics.originalWidth
        next.set(pageNumber, {
          ...metrics,
          renderWidth: pageWidth,
          renderHeight: metrics.originalHeight * scale,
        })
      })
      return next
    })
  }, [pageWidth])

  function handlePageRenderSuccess(pageNumber: number) {
    setPageRenderVersions((prev) => {
      const next = new Map(prev)
      next.set(pageNumber, (prev.get(pageNumber) ?? 0) + 1)
      return next
    })
  }

  async function handlePageLoadSuccess(pageNumber: number, page: PDFPageProxy) {
    const viewport = page.getViewport({ scale: 1 })
    const scale = pageWidth / viewport.width
    const extractedImageSize = await extractPageImageSizes(page)

    setPageMetrics((prev) => {
      const next = new Map(prev)
      next.set(pageNumber, {
        originalWidth: viewport.width,
        originalHeight: viewport.height,
        renderWidth: pageWidth,
        renderHeight: viewport.height * scale,
        fullPageImageSize: extractedImageSize.fullPageImageSize,
        dpiInferenceImageSize: extractedImageSize.largestImageSize,
        fullPageImagePlacement: extractedImageSize.fullPageImagePlacement,
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
              const revealRects = revealRectsByPage.get(pageNumber) ?? []
              const shouldMaskPage = maskMode === 'bbox-only'

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
                  <div
                    className="relative inline-block"
                    ref={(element) => {
                      if (element) {
                        pageCanvasHostRefs.current.set(pageNumber, element)
                      } else {
                        pageCanvasHostRefs.current.delete(pageNumber)
                      }
                    }}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={pageWidth}
                      renderTextLayer={renderTextLayer}
                      renderAnnotationLayer={renderAnnotationLayer}
                      canvasBackground="white"
                      onLoadSuccess={(page) =>
                        handlePageLoadSuccess(pageNumber, page)
                      }
                      onRenderSuccess={() =>
                        handlePageRenderSuccess(pageNumber)
                      }
                    />
                    {shouldMaskPage ? (
                      <PdfPageMaskOverlay
                        pageNumber={pageNumber}
                        maskIdPrefix={maskIdPrefix}
                        revealRects={revealRects}
                        pageCanvasHostRefs={pageCanvasHostRefs}
                        pageRenderVersion={
                          pageRenderVersions.get(pageNumber) ?? 0
                        }
                        renderWidth={metrics?.renderWidth}
                        renderHeight={metrics?.renderHeight}
                      />
                    ) : null}
                    {showHighlight
                      ? (() => {
                          const inferBboxes =
                            highlight.referenceBboxes ?? highlight.bboxes

                          return highlight.bboxes.map((bbox, index) => (
                            <PdfBboxHighlight
                              key={index}
                              bbox={bbox}
                              metrics={metrics}
                              highlight={highlight}
                              inferBboxes={inferBboxes}
                            />
                          ))
                        })()
                      : null}
                  </div>
                </div>
              )
            })}
        </Document>
      </div>
    </div>
  )
}
