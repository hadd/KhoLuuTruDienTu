import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Document, Page, pdfjs } from 'react-pdf'

import { Button } from '@/components/ui/button'
import { useInlinePdfUrl } from '@/lib/hooks/useInlinePdfUrl'
import { cn } from '@/lib/utils/cn'

// Configure PDF.js worker (same as PrintPdfPages)
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const FALLBACK_WIDTH = 400

interface PdfViewerProps {
  fileUrl: string
  fileName?: string
  className?: string
  showBorder?: boolean
  fixedHeight?: number
}

export function PdfViewer({
  fileUrl,
  fileName,
  className,
  showBorder = true,
  fixedHeight,
}: PdfViewerProps) {
  const { t } = useTranslation('common')
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(FALLBACK_WIDTH)
  const [numPages, setNumPages] = useState<number | null>(null)

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
  }, [effectiveFileUrl])

  const isViewerMounted = Boolean(fileUrl && !isUrlLoading && !urlError)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const applyWidth = (w: number) => {
      if (w > 0) setContainerWidth(w)
    }

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.clientWidth
      applyWidth(w)
    })
    ro.observe(el)
    applyWidth(el.clientWidth)
    const rafId = requestAnimationFrame(() => applyWidth(el.clientWidth))
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [isViewerMounted])

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
            {t('rightPanel.pdfViewer.noFile', {
              defaultValue: 'No file available',
            })}
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
        {t('rightPanel.pdfViewer.loading', {
          defaultValue: 'Loading PDF...',
        })}
      </p>
    </div>
  )

  const errorNode = (
    <div
      className={cn(
        'flex h-full items-center justify-center rounded-lg bg-background p-4',
        showBorder && 'border border-border',
        fixedHeight ? 'min-h-0' : 'min-h-[400px]',
      )}
    >
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          {t('rightPanel.pdfViewer.previewNotAvailable', {
            defaultValue: 'Preview not available',
          })}
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            {t('rightPanel.pdfViewer.openInNewTab', {
              defaultValue: 'Open in new tab',
            })}
          </a>
        </Button>
      </div>
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
          {errorNode}
        </div>
      </div>
    )
  }

  function onDocumentLoadSuccess({ numPages: total }: { numPages: number }) {
    setNumPages(total)
  }

  function onDocumentLoadError() {
    setNumPages(null)
  }

  const pageWidth = Math.max(containerWidth - 16, 1)

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
            Array.from({ length: numPages }, (_, i) => (
              <div key={i + 1} className="flex justify-center p-2">
                <Page
                  pageNumber={i + 1}
                  width={pageWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  canvasBackground="white"
                />
              </div>
            ))}
        </Document>
      </div>
    </div>
  )
}