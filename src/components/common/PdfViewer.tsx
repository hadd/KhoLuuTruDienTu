import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Document, Page, pdfjs } from 'react-pdf'

import { PdfPageMaskOverlay } from '@/components/common/PdfPageMaskOverlay'
import type {
  BboxPageMetrics,
  BboxTuple,
  RenderRect,
  SourcePageSize,
} from '@/features/data-management/lib/bboxCoords'
import {
  computeOcrRasterPageSize,
  computeRasterPageSizeFromDpi,
  inferOcrDpiFromEmbeddedImage,
  mapBboxToRenderRect,
  mapBboxToRenderRectViaImagePlacement,
  pdfImageBBoxToRenderRect,
  pickOcrPixelSize,
  resolveSourcePageSize,
} from '@/features/data-management/lib/bboxCoords'
import type { PdfImagePlacement } from '@/features/data-management/lib/pdfPageRaster'
import { extractPageImageSizes } from '@/features/data-management/lib/pdfPageRaster'
import {
  extractCopyTextWithinRects,
  resetTextLayerCopyRestriction,
  restrictTextLayerToRects,
} from '@/features/data-management/lib/pdfTextLayerRestriction'
import { useInlinePdfUrl } from '@/lib/hooks/useInlinePdfUrl'
import { cn } from '@/lib/utils/cn'

// Worker lấy từ chính pdfjs-dist đang cài (Vite bundle qua ?url) — luôn khớp
// version API, tránh "Setting up fake worker failed" do copy trong public/ lệch bản.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

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

export interface PdfUserHighlight {
  id: string
  page: number
  /** [x0, y0, x1, y1] ratios 0–1 of page width/height (top-left origin). */
  bboxes: Array<[number, number, number, number]>
  color?: string
}

interface PdfViewerProps {
  fileUrl: string
  fileName?: string
  className?: string
  showBorder?: boolean
  /** Remove page padding and use full container width for the PDF page. */
  fitEdge?: boolean
  fixedHeight?: number
  highlight?: PdfFieldHighlight | null
  /** Personal reading highlights (ratio bboxes). */
  userHighlights?: Array<PdfUserHighlight>
  /** Scroll this page into view when set/changed. */
  scrollToPage?: number | null
  maskMode?: 'off' | 'bbox-only'
  revealRegions?: Array<PdfBboxRevealRegion>
  renderTextLayer?: boolean
  renderAnnotationLayer?: boolean
  restrictTextCopyToRevealRegions?: boolean
  onLoadFailed?: () => void
  /** Signature placement overlay (percent of page, top-left origin like web UI). */
  signaturePlacement?: {
    pageNumber: number
    xRatio: number
    yRatio: number
    widthPercent?: number
    heightPercent?: number
    label?: string
  } | null
  /** Click on a PDF page → ratios 0–100 (web top-left origin). */
  onPageClick?: (info: {
    pageNumber: number
    xRatio: number
    yRatio: number
  }) => void
  /** Fired when the most-visible page changes while scrolling. */
  onVisiblePageChange?: (pageNumber: number) => void
  /** Enable text-selection capture for highlight/note creation. */
  textSelectMode?: boolean
  onTextSelect?: (info: {
    pageNumber: number
    selectedText: string
    bbox: [number, number, number, number]
  }) => void
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
          inferOcrDpiFromEmbeddedImage(metrics.dpiInferenceImageSize, metrics),
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
  const rect = resolveHighlightRenderRect(bbox, metrics, highlight, inferBboxes)
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

function PdfUserHighlightOverlay({
  highlight,
}: {
  highlight: PdfUserHighlight
}) {
  const color = highlight.color || 'rgba(250, 204, 21, 0.45)'
  return (
    <>
      {highlight.bboxes.map((bbox, index) => {
        const [x0, y0, x1, y1] = bbox
        const left = Math.min(x0, x1) * 100
        const top = Math.min(y0, y1) * 100
        const width = Math.abs(x1 - x0) * 100
        const height = Math.abs(y1 - y0) * 100
        if (width <= 0 || height <= 0) return null
        return (
          <div
            key={`${highlight.id}-${index}`}
            className="pointer-events-none absolute z-20 rounded-sm"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              backgroundColor: color,
            }}
            aria-hidden
          />
        )
      })}
    </>
  )
}

function captureTextSelectionOnPage(
  pageNumber: number,
  host: HTMLElement,
): {
  pageNumber: number
  selectedText: string
  bbox: [number, number, number, number]
} | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null
  }
  const selectedText = selection.toString().trim()
  if (!selectedText) return null

  const range = selection.getRangeAt(0)
  const common = range.commonAncestorContainer
  const commonEl =
    common.nodeType === Node.ELEMENT_NODE
      ? (common as Element)
      : common.parentElement
  if (!commonEl || !host.contains(commonEl)) return null

  const hostRect = host.getBoundingClientRect()
  if (hostRect.width <= 0 || hostRect.height <= 0) return null

  const rects = Array.from(range.getClientRects()).filter(
    (r) => r.width > 0 && r.height > 0,
  )
  if (rects.length === 0) return null

  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const rect of rects) {
    left = Math.min(left, rect.left)
    top = Math.min(top, rect.top)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  }

  const x0 = Math.max(0, Math.min(1, (left - hostRect.left) / hostRect.width))
  const y0 = Math.max(0, Math.min(1, (top - hostRect.top) / hostRect.height))
  const x1 = Math.max(0, Math.min(1, (right - hostRect.left) / hostRect.width))
  const y1 = Math.max(0, Math.min(1, (bottom - hostRect.top) / hostRect.height))

  return {
    pageNumber,
    selectedText,
    bbox: [x0, y0, x1, y1],
  }
}

export function PdfViewer({
  fileUrl,
  fileName: _fileName,
  className,
  showBorder = true,
  fitEdge = false,
  fixedHeight,
  highlight = null,
  userHighlights = [],
  scrollToPage = null,
  maskMode = 'off',
  revealRegions = [],
  renderTextLayer = true,
  renderAnnotationLayer = true,
  restrictTextCopyToRevealRegions = false,
  onLoadFailed,
  signaturePlacement = null,
  onPageClick,
  onVisiblePageChange,
  textSelectMode = false,
  onTextSelect,
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

  useEffect(() => {
    if (!onLoadFailed) return
    if (urlError || documentError) {
      onLoadFailed()
    }
  }, [urlError, documentError, onLoadFailed])

  useEffect(() => {
    if (!scrollToPage || scrollToPage < 1) return
    const pageWrapper = pageWrapperRefs.current.get(scrollToPage)
    if (!pageWrapper) return
    pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollToPage, numPages, pageMetrics.size])

  useEffect(() => {
    if (!onVisiblePageChange || !containerRef.current || !numPages) return

    const container = containerRef.current
    const ratios = new Map<number, number>()
    let lastReported = 0

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const pageAttr = (entry.target as HTMLElement).dataset.pageNumber
          const pageNumber = pageAttr ? Number(pageAttr) : NaN
          if (!Number.isFinite(pageNumber)) continue
          ratios.set(pageNumber, entry.intersectionRatio)
        }
        let bestPage = lastReported || 1
        let bestRatio = -1
        for (const [page, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestPage = page
          }
        }
        if (bestPage !== lastReported && bestRatio > 0) {
          lastReported = bestPage
          onVisiblePageChange(bestPage)
        }
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    for (const [pageNumber, el] of pageWrapperRefs.current) {
      el.dataset.pageNumber = String(pageNumber)
      observer.observe(el)
    }

    return () => observer.disconnect()
  }, [onVisiblePageChange, numPages, pageRenderVersions])

  useEffect(() => {
    if (!textSelectMode || !onTextSelect) return

    function handleMouseUp() {
      for (const [pageNumber, host] of pageCanvasHostRefs.current) {
        const captured = captureTextSelectionOnPage(pageNumber, host)
        if (captured) {
          onTextSelect?.(captured)
          window.getSelection()?.removeAllRanges()
          break
        }
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [textSelectMode, onTextSelect])

  const userHighlightsByPage = useMemo(() => {
    const mapped = new Map<number, Array<PdfUserHighlight>>()
    for (const item of userHighlights) {
      const list = mapped.get(item.page) ?? []
      list.push(item)
      mapped.set(item.page, list)
    }
    return mapped
  }, [userHighlights])

  const revealRectsByPage = useMemo(() => {
    const mapped = new Map<number, Array<RenderRect>>()
    const needsRevealRects =
      maskMode === 'bbox-only' || restrictTextCopyToRevealRegions
    if (!needsRevealRects) return mapped

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
  }, [maskMode, pageMetrics, revealRegions, restrictTextCopyToRevealRegions])

  const isViewerMounted = Boolean(fileUrl && !isUrlLoading && !urlError)
  const pageWidth = Math.max(containerWidth - (fitEdge ? 0 : 16), 1)
  const highlightPageMetrics = highlight?.page
    ? pageMetrics.get(highlight.page)
    : undefined

  useEffect(() => {
    if (!highlight?.page) return

    const container = containerRef.current
    const pageWrapper = pageWrapperRefs.current.get(highlight.page)
    if (!container || !pageWrapper) return

    const pageCanvasHost =
      pageCanvasHostRefs.current.get(highlight.page) ?? null
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

  function applyTextCopyRestriction(pageNumber?: number) {
    const hosts =
      pageNumber !== undefined
        ? [[pageNumber, pageCanvasHostRefs.current.get(pageNumber)] as const]
        : Array.from(pageCanvasHostRefs.current.entries())

    hosts.forEach(([currentPageNumber, host]) => {
      if (!host) return

      if (restrictTextCopyToRevealRegions) {
        const revealRects = revealRectsByPage.get(currentPageNumber) ?? []
        restrictTextLayerToRects(host, revealRects)
        return
      }

      resetTextLayerCopyRestriction(host)
    })
  }

  function scheduleTextCopyRestriction(pageNumber?: number) {
    applyTextCopyRestriction(pageNumber)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyTextCopyRestriction(pageNumber)
      })
    })
  }

  function handleTextLayerRenderSuccess(pageNumber: number) {
    const host = pageCanvasHostRefs.current.get(pageNumber)
    if (!host) return

    if (restrictTextCopyToRevealRegions) {
      scheduleTextCopyRestriction(pageNumber)
      return
    }

    resetTextLayerCopyRestriction(host)
  }

  useEffect(() => {
    if (!restrictTextCopyToRevealRegions) {
      applyTextCopyRestriction()
      return
    }

    scheduleTextCopyRestriction()

    return undefined
  }, [
    restrictTextCopyToRevealRegions,
    revealRectsByPage,
    pageRenderVersions,
    pageWidth,
    renderTextLayer,
  ])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !restrictTextCopyToRevealRegions) return

    function resolveCopyContext(selection: Selection | null): {
      pageHost: HTMLElement | null
      revealRects: Array<RenderRect>
    } {
      const anchorNode = selection?.anchorNode
      if (!anchorNode) {
        return { pageHost: null, revealRects: [] }
      }

      for (const [pageNumber, host] of pageCanvasHostRefs.current.entries()) {
        if (!host?.contains(anchorNode)) continue

        return {
          pageHost: host,
          revealRects: revealRectsByPage.get(pageNumber) ?? [],
        }
      }

      return { pageHost: null, revealRects: [] }
    }

    function handleCopy(event: ClipboardEvent) {
      const selection = window.getSelection()
      const { pageHost, revealRects } = resolveCopyContext(selection)
      const filtered = extractCopyTextWithinRects(selection, container, {
        pageHost,
        revealRects,
      })
      if (filtered === null) return

      event.preventDefault()
      event.clipboardData?.setData('text/plain', filtered)
    }

    container.addEventListener('copy', handleCopy)
    return () => {
      container.removeEventListener('copy', handleCopy)
    }
  }, [restrictTextCopyToRevealRegions, revealRectsByPage])

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
    titleKey:
      | 'rightPanel.pdfViewer.loadError'
      | 'rightPanel.pdfViewer.renderError',
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
              const pageUserHighlights =
                userHighlightsByPage.get(pageNumber) ?? []
              const shouldMaskPage = maskMode === 'bbox-only'

              return (
                <div
                  key={pageNumber}
                  data-page-number={pageNumber}
                  ref={(element) => {
                    if (element) {
                      pageWrapperRefs.current.set(pageNumber, element)
                    } else {
                      pageWrapperRefs.current.delete(pageNumber)
                    }
                  }}
                  className={cn(
                    'flex justify-center',
                    fitEdge ? 'p-0' : 'p-2',
                  )}
                >
                  <div
                    className={cn(
                      'relative inline-block',
                      onPageClick && 'cursor-crosshair',
                      textSelectMode && 'select-text',
                      renderTextLayer &&
                        restrictTextCopyToRevealRegions &&
                        '[&_.react-pdf__Page__canvas]:pointer-events-none [&_.react-pdf__Page__textContent]:!z-[25]',
                    )}
                    ref={(element) => {
                      if (element) {
                        pageCanvasHostRefs.current.set(pageNumber, element)
                      } else {
                        pageCanvasHostRefs.current.delete(pageNumber)
                      }
                    }}
                    onClick={
                      onPageClick
                        ? (event) => {
                            const host = event.currentTarget
                            const rect = host.getBoundingClientRect()
                            if (rect.width <= 0 || rect.height <= 0) return
                            const xRatio = Math.max(
                              0,
                              Math.min(
                                100,
                                ((event.clientX - rect.left) / rect.width) * 100,
                              ),
                            )
                            const yRatio = Math.max(
                              0,
                              Math.min(
                                100,
                                ((event.clientY - rect.top) / rect.height) * 100,
                              ),
                            )
                            onPageClick({
                              pageNumber,
                              xRatio: Math.round(xRatio * 10) / 10,
                              yRatio: Math.round(yRatio * 10) / 10,
                            })
                          }
                        : undefined
                    }
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={pageWidth}
                      renderTextLayer={renderTextLayer && !onPageClick}
                      renderAnnotationLayer={
                        renderAnnotationLayer && !onPageClick
                      }
                      canvasBackground="white"
                      onLoadSuccess={(page) =>
                        handlePageLoadSuccess(pageNumber, page)
                      }
                      onRenderSuccess={() =>
                        handlePageRenderSuccess(pageNumber)
                      }
                      onRenderTextLayerSuccess={() =>
                        handleTextLayerRenderSuccess(pageNumber)
                      }
                    />
                    {signaturePlacement &&
                    signaturePlacement.pageNumber === pageNumber ? (
                      <div
                        className="pointer-events-none absolute z-40 border border-dashed border-gray-700 bg-white/90 p-0.5 text-[7px] shadow-sm"
                        style={{
                          left: `${signaturePlacement.xRatio}%`,
                          top: `${signaturePlacement.yRatio}%`,
                          width: `${signaturePlacement.widthPercent ?? 28}%`,
                          height: `${signaturePlacement.heightPercent ?? 8}%`,
                        }}
                      >
                        <div className="flex h-full items-center justify-center overflow-hidden px-0.5 font-semibold text-gray-800">
                          {signaturePlacement.label ?? 'Chữ ký số'}
                        </div>
                      </div>
                    ) : null}
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
                    {pageUserHighlights.map((item) => (
                      <PdfUserHighlightOverlay key={item.id} highlight={item} />
                    ))}
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
