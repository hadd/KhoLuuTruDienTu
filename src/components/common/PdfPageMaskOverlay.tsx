import { useEffect, useRef, type RefObject } from 'react'

import {
  pdfMaskConfig,
  type PdfMaskConfig,
} from '@/features/data-management/lib/pdfMaskConfig'
import { renderMosaicFromCanvas } from '@/features/data-management/lib/pdfMaskRenderer'
import type { RenderRect } from '@/features/data-management/lib/bboxCoords'

interface PdfPageMaskOverlayProps {
  pageNumber: number
  maskIdPrefix: string
  revealRects: Array<RenderRect>
  pageCanvasHostRefs: RefObject<Map<number, HTMLDivElement>>
  pageRenderVersion: number
  renderWidth?: number
  renderHeight?: number
  config?: PdfMaskConfig
}

function buildMaskStyle(maskId: string): React.CSSProperties {
  const maskUrl = `url(#${maskId})`
  return {
    mask: maskUrl,
    WebkitMask: maskUrl,
  }
}

export function PdfPageMaskOverlay({
  pageNumber,
  maskIdPrefix,
  revealRects,
  pageCanvasHostRefs,
  pageRenderVersion,
  renderWidth,
  renderHeight,
  config = pdfMaskConfig,
}: PdfPageMaskOverlayProps) {
  const mosaicCanvasRef = useRef<HTMLCanvasElement>(null)
  const maskId = `${maskIdPrefix}-${pageNumber}`
  const hasRevealCutouts =
    revealRects.length > 0 &&
    renderWidth != null &&
    renderHeight != null &&
    renderWidth > 0 &&
    renderHeight > 0
  const maskStyle = hasRevealCutouts ? buildMaskStyle(maskId) : undefined
  const isMosaicReady = config.type === 'mosaic' && pageRenderVersion > 0

  useEffect(() => {
    if (config.type !== 'mosaic') return

    const host = pageCanvasHostRefs.current?.get(pageNumber)
    const sourceCanvas = host?.querySelector('canvas')
    const targetCanvas = mosaicCanvasRef.current
    if (!host || !sourceCanvas || !targetCanvas) return

    const mosaic = renderMosaicFromCanvas(sourceCanvas, config.mosaicBlockSize)
    targetCanvas.width = mosaic.width
    targetCanvas.height = mosaic.height

    const ctx = targetCanvas.getContext('2d')
    ctx?.clearRect(0, 0, targetCanvas.width, targetCanvas.height)
    ctx?.drawImage(mosaic, 0, 0)
  }, [
    config.mosaicBlockSize,
    config.type,
    pageCanvasHostRefs,
    pageNumber,
    pageRenderVersion,
  ])

  return (
    <>
      {hasRevealCutouts ? (
        <svg
          className="pointer-events-none absolute h-0 w-0"
          aria-hidden
          width={renderWidth}
          height={renderHeight}
          viewBox={`0 0 ${renderWidth} ${renderHeight}`}
        >
          <defs>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={renderWidth}
              height={renderHeight}
            >
              <rect
                x={0}
                y={0}
                width={renderWidth}
                height={renderHeight}
                fill="white"
              />
              {revealRects.map((rect, rectIndex) => (
                <rect
                  key={rectIndex}
                  x={rect.left}
                  y={rect.top}
                  width={rect.width}
                  height={rect.height}
                  fill="black"
                />
              ))}
            </mask>
          </defs>
        </svg>
      ) : null}

      {config.type === 'gaussian' || !isMosaicReady ? (
        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            ...maskStyle,
            backdropFilter: `blur(${config.gaussianBlurPx}px)`,
            WebkitBackdropFilter: `blur(${config.gaussianBlurPx}px)`,
          }}
          aria-hidden
        />
      ) : (
        <canvas
          ref={mosaicCanvasRef}
          className="pointer-events-none absolute inset-0 z-20 h-full w-full"
          style={maskStyle}
          aria-hidden
        />
      )}
    </>
  )
}
