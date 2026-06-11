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

const RASTER_DETECTION_RATIO = 1.2
const PDF_POINT_MAX = 842

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

/** Infer OCR A4 page size when bbox coords exceed PDF point viewport. */
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
  const looksLikeRaster =
    extent.maxX > originalWidth * RASTER_DETECTION_RATIO ||
    extent.maxY > originalHeight * RASTER_DETECTION_RATIO

  return looksLikeRaster ? ocrA4PageSize() : null
}

export function resolveSourcePageSize(
  bboxes: Array<BboxTuple>,
  pdfPageMetrics: Pick<BboxPageMetrics, 'originalWidth' | 'originalHeight'>,
  explicit?: { width?: number; height?: number },
): SourcePageSize | null {
  if (
    explicit &&
    explicit.width > 0 &&
    explicit.height > 0
  ) {
    return { width: explicit.width, height: explicit.height }
  }

  return inferSourcePageSize(bboxes, pdfPageMetrics)
}

export function mapBboxToRenderRect(
  bbox: BboxTuple,
  metrics: BboxPageMetrics,
  sourcePageSize?: SourcePageSize | null,
): { left: number; top: number; width: number; height: number } | null {
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
