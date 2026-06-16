import type { DataDocumentFieldT } from '@/features/data-management/types'

export type BboxTuple = [number, number, number, number]

export interface BboxPageMetrics {
  originalWidth: number
  originalHeight: number
  renderWidth: number
  renderHeight: number
}

export interface SourcePageSize {
  width: number
  height: number
}

export interface RenderRect {
  left: number
  top: number
  width: number
  height: number
}

export interface PdfImagePdfBBox {
  minX: number
  minY: number
  width: number
  height: number
}

export interface OcrPixelSizeCandidates {
  api?: SourcePageSize | null
  ocrRaster?: SourcePageSize | null
  embedded?: SourcePageSize | null
  dpiInferred?: SourcePageSize | null
}

export interface OcrDpi {
  dpiX: number
  dpiY: number
}

export interface ResolveSourcePageSizeOptions {
  /** Highest priority — from OCR metadata `page_width` / `page_height` */
  width?: number
  height?: number
  /** Full-page embedded scan image pixels */
  embeddedImageSize?: SourcePageSize | null
  /** Any large embedded image — used to infer effective OCR DPI when full-page match is unavailable */
  dpiInferenceImageSize?: SourcePageSize | null
}

export interface PdfFieldHighlightInput {
  page: number
  bboxes: Array<BboxTuple>
  sourcePageWidth?: number
  sourcePageHeight?: number
  referenceBboxes?: Array<BboxTuple>
}

/** A4 raster canvas @ 300 DPI — hệ tọa độ bbox từ pipeline OCR */
export const OCR_A4_PAGE_WIDTH = 2480
export const OCR_A4_PAGE_HEIGHT = 3508

/** DPI mà OCR pipeline dùng để render PDF → raster image */
export const OCR_RENDER_DPI = 300
const PDF_POINTS_PER_INCH = 72

const RASTER_DETECTION_RATIO = 1.2
const PDF_POINT_MAX = 842
/** Padding when bbox coords exceed DPI-inferred page size */
const BBOX_OVERFLOW_EXPANSION_MARGIN = 1.03

function collectMaxExtent(
  bboxes: Array<BboxTuple>,
): { maxX: number; maxY: number } | null {
  if (bboxes.length === 0) return null

  let maxX = 0
  let maxY = 0
  for (const [, , x2, y2] of bboxes) {
    maxX = Math.max(maxX, x2)
    maxY = Math.max(maxY, y2)
  }

  if (maxX <= 0 || maxY <= 0) return null
  return { maxX, maxY }
}

function ocrA4PageSize(): SourcePageSize {
  return { width: OCR_A4_PAGE_WIDTH, height: OCR_A4_PAGE_HEIGHT }
}

/** Tính kích thước raster từ PDF viewport thực tế @ OCR_RENDER_DPI */
export function computeOcrRasterPageSize(
  pdfWidth: number,
  pdfHeight: number,
): SourcePageSize {
  const scale = OCR_RENDER_DPI / PDF_POINTS_PER_INCH
  return {
    width: Math.round(pdfWidth * scale),
    height: Math.round(pdfHeight * scale),
  }
}

/** effectiveDpiX = imageWidth * 72 / viewportWidthPoints */
export function inferOcrDpiFromEmbeddedImage(
  imageSize: SourcePageSize,
  viewport: Pick<BboxPageMetrics, 'originalWidth' | 'originalHeight'>,
): OcrDpi {
  return {
    dpiX: (imageSize.width * PDF_POINTS_PER_INCH) / viewport.originalWidth,
    dpiY: (imageSize.height * PDF_POINTS_PER_INCH) / viewport.originalHeight,
  }
}

export function computeRasterPageSizeFromDpi(
  viewport: Pick<BboxPageMetrics, 'originalWidth' | 'originalHeight'>,
  dpi: OcrDpi,
): SourcePageSize {
  return {
    width: Math.round(
      (viewport.originalWidth * dpi.dpiX) / PDF_POINTS_PER_INCH,
    ),
    height: Math.round(
      (viewport.originalHeight * dpi.dpiY) / PDF_POINTS_PER_INCH,
    ),
  }
}

function looksLikeRasterCoords(
  extent: { maxX: number; maxY: number },
  pdfWidth: number,
  pdfHeight: number,
): boolean {
  return (
    extent.maxX > pdfWidth * RASTER_DETECTION_RATIO ||
    extent.maxY > pdfHeight * RASTER_DETECTION_RATIO
  )
}

/** @deprecated Kept for backward compatibility. Prefer `resolveSourcePageSize`. */
export function inferSourcePageSizeFromExtent(
  bboxes: Array<BboxTuple>,
  pdfWidth: number,
  pdfHeight: number,
): SourcePageSize | null {
  const extent = collectMaxExtent(bboxes)
  if (!extent || !looksLikeRasterCoords(extent, pdfWidth, pdfHeight)) {
    return null
  }

  return {
    width: extent.maxX,
    height: extent.maxY,
  }
}

/** Infer OCR raster page size when bbox coords exceed PDF point viewport. */
export function inferSourcePageSize(
  bboxes: Array<BboxTuple>,
  pdfPageMetrics?: Pick<BboxPageMetrics, 'originalWidth' | 'originalHeight'>,
): SourcePageSize | null {
  const extent = collectMaxExtent(bboxes)
  if (!extent) return null

  if (!pdfPageMetrics) {
    return extent.maxX > PDF_POINT_MAX || extent.maxY > PDF_POINT_MAX
      ? ocrA4PageSize()
      : null
  }

  const { originalWidth, originalHeight } = pdfPageMetrics
  if (!looksLikeRasterCoords(extent, originalWidth, originalHeight)) {
    return null
  }

  return computeOcrRasterPageSize(originalWidth, originalHeight)
}

/** Expand DPI-based page size when bbox extent exceeds inferred dimensions. */
function expandSourcePageSizeForBboxOverflow(
  dpiSize: SourcePageSize,
  bboxes: Array<BboxTuple>,
): SourcePageSize {
  const extent = collectMaxExtent(bboxes)
  if (!extent) return dpiSize

  if (extent.maxX > dpiSize.width || extent.maxY > dpiSize.height) {
    return {
      width: Math.max(
        dpiSize.width,
        Math.ceil(extent.maxX * BBOX_OVERFLOW_EXPANSION_MARGIN),
      ),
      height: Math.max(
        dpiSize.height,
        Math.ceil(extent.maxY * BBOX_OVERFLOW_EXPANSION_MARGIN),
      ),
    }
  }

  return dpiSize
}

function resolveFromInferredEmbeddedDpi(
  imageSize: SourcePageSize,
  pdfPageMetrics: Pick<BboxPageMetrics, 'originalWidth' | 'originalHeight'>,
  bboxes: Array<BboxTuple>,
): SourcePageSize {
  const dpi = inferOcrDpiFromEmbeddedImage(imageSize, pdfPageMetrics)
  const computed = computeRasterPageSizeFromDpi(pdfPageMetrics, dpi)
  return expandSourcePageSizeForBboxOverflow(computed, bboxes)
}

export function resolveSourcePageSize(
  bboxes: Array<BboxTuple>,
  pdfPageMetrics: Pick<BboxPageMetrics, 'originalWidth' | 'originalHeight'>,
  options?: ResolveSourcePageSizeOptions,
): SourcePageSize | null {
  const apiWidth = options?.width
  const apiHeight = options?.height
  if (
    apiWidth != null &&
    apiHeight != null &&
    apiWidth > 0 &&
    apiHeight > 0
  ) {
    return { width: apiWidth, height: apiHeight }
  }

  const extent = collectMaxExtent(bboxes)
  if (
    extent &&
    looksLikeRasterCoords(
      extent,
      pdfPageMetrics.originalWidth,
      pdfPageMetrics.originalHeight,
    )
  ) {
    const ocrRaster = computeOcrRasterPageSize(
      pdfPageMetrics.originalWidth,
      pdfPageMetrics.originalHeight,
    )
    return expandSourcePageSizeForBboxOverflow(ocrRaster, bboxes)
  }

  const embedded = options?.embeddedImageSize
  if (embedded && embedded.width > 0 && embedded.height > 0) {
    return { width: embedded.width, height: embedded.height }
  }

  const dpiImage = options?.dpiInferenceImageSize
  if (dpiImage && dpiImage.width > 0 && dpiImage.height > 0) {
    return resolveFromInferredEmbeddedDpi(dpiImage, pdfPageMetrics, bboxes)
  }

  const dpiSize = inferSourcePageSize(bboxes, pdfPageMetrics)
  if (dpiSize) {
    return expandSourcePageSizeForBboxOverflow(dpiSize, bboxes)
  }

  return null
}

/** Chọn kích thước pixel OCR khớp nhất với extent của bbox. */
export function pickOcrPixelSize(
  bboxes: Array<BboxTuple>,
  candidates: OcrPixelSizeCandidates,
  pdfPageMetrics?: Pick<BboxPageMetrics, 'originalWidth' | 'originalHeight'>,
): SourcePageSize | null {
  if (
    candidates.api &&
    candidates.api.width > 0 &&
    candidates.api.height > 0
  ) {
    return candidates.api
  }

  const ordered = [
    candidates.ocrRaster,
    candidates.embedded,
    candidates.dpiInferred,
  ].filter(
    (candidate): candidate is SourcePageSize =>
      candidate != null && candidate.width > 0 && candidate.height > 0,
  )

  if (ordered.length === 0) return null

  const extent = collectMaxExtent(bboxes)
  if (!extent) return ordered[0]

  const containing = ordered.filter(
    (candidate) =>
      extent.maxX <= candidate.width && extent.maxY <= candidate.height,
  )

  if (containing.length > 0) {
    const preferRaster =
      pdfPageMetrics &&
      candidates.ocrRaster &&
      containing.includes(candidates.ocrRaster) &&
      looksLikeRasterCoords(
        extent,
        pdfPageMetrics.originalWidth,
        pdfPageMetrics.originalHeight,
      )

    if (preferRaster) return candidates.ocrRaster!

    return containing.reduce((best, candidate) =>
      candidate.width * candidate.height < best.width * best.height
        ? candidate
        : best,
    )
  }

  return ordered.reduce((best, candidate) => {
    const overflow =
      Math.max(0, extent.maxX / candidate.width - 1) +
      Math.max(0, extent.maxY / candidate.height - 1)
    const bestOverflow =
      Math.max(0, extent.maxX / best.width - 1) +
      Math.max(0, extent.maxY / best.height - 1)
    return overflow < bestOverflow ? candidate : best
  })
}

/** Map PDF image bbox (bottom-left origin) → render rect (top-left origin). */
export function pdfImageBBoxToRenderRect(
  pdfBBox: PdfImagePdfBBox,
  metrics: BboxPageMetrics,
): RenderRect {
  const { originalWidth, originalHeight, renderWidth, renderHeight } = metrics
  const scaleX = renderWidth / originalWidth
  const scaleY = renderHeight / originalHeight

  return {
    left: pdfBBox.minX * scaleX,
    top: (originalHeight - pdfBBox.minY - pdfBBox.height) * scaleY,
    width: pdfBBox.width * scaleX,
    height: pdfBBox.height * scaleY,
  }
}

/** Map OCR bbox (image pixel, top-left) → render rect via embedded image placement. */
export function mapBboxToRenderRectViaImagePlacement(
  bbox: BboxTuple,
  ocrPixelSize: SourcePageSize,
  imageRenderRect: RenderRect,
): RenderRect | null {
  const [x1, y1, x2, y2] = bbox
  if (x2 <= x1 || y2 <= y1) return null

  const scaleX = imageRenderRect.width / ocrPixelSize.width
  const scaleY = imageRenderRect.height / ocrPixelSize.height

  return {
    left: imageRenderRect.left + x1 * scaleX,
    top: imageRenderRect.top + y1 * scaleY,
    width: (x2 - x1) * scaleX,
    height: (y2 - y1) * scaleY,
  }
}

export function mapBboxToRenderRect(
  bbox: BboxTuple,
  metrics: BboxPageMetrics,
  sourcePageSize?: SourcePageSize | null,
): RenderRect | null {
  const [x1, y1, x2, y2] = bbox
  if (x2 <= x1 || y2 <= y1) return null

  const { originalWidth, originalHeight, renderWidth, renderHeight } = metrics
  const sourceWidth = sourcePageSize?.width ?? originalWidth
  const sourceHeight = sourcePageSize?.height ?? originalHeight

  const scaleX = renderWidth / sourceWidth
  const scaleY = renderHeight / sourceHeight

  return {
    left: x1 * scaleX,
    top: y1 * scaleY,
    width: (x2 - x1) * scaleX,
    height: (y2 - y1) * scaleY,
  }
}

export function buildPdfFieldHighlight(
  field: DataDocumentFieldT,
  groupFields: Array<DataDocumentFieldT>,
): PdfFieldHighlightInput | null {
  if (field.page < 1 || field.bboxes.length === 0) return null

  const referenceBboxes = groupFields
    .filter((item) => item.page === field.page && item.bboxes.length > 0)
    .flatMap((item) => item.bboxes)

  return {
    page: field.page,
    bboxes: field.bboxes,
    referenceBboxes,
    ...(field.page_width && field.page_height
      ? {
          sourcePageWidth: field.page_width,
          sourcePageHeight: field.page_height,
        }
      : {}),
  }
}
