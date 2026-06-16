import { OPS, Util } from 'pdfjs-dist'
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'

import type { SourcePageSize } from '@/features/data-management/lib/bboxCoords'

type PdfMatrix = [number, number, number, number, number, number]

const IDENTITY_MATRIX: PdfMatrix = [1, 0, 0, 1, 0, 0]

export interface PdfImagePdfBBox {
  minX: number
  minY: number
  width: number
  height: number
}

export interface PdfImagePlacement {
  pixelSize: SourcePageSize
  pdfBBox: PdfImagePdfBBox
}

interface PdfImageObject {
  width?: number
  height?: number
}

/** Min fraction of full-page area for a scan image candidate */
const FULL_PAGE_MIN_COVERAGE = 0.5
/** Max aspect-ratio drift from PDF viewport (15%) */
const FULL_PAGE_MAX_ASPECT_DRIFT = 0.15

export interface PageImageSizes {
  /** Embedded scan covering most of the page — best OCR coordinate match */
  fullPageImageSize: SourcePageSize | null
  /** Largest embedded image — fallback for DPI inference */
  largestImageSize: SourcePageSize | null
  /** Full-page scan placement on PDF page (CTM from operator list) */
  fullPageImagePlacement: PdfImagePlacement | null
}

function isPdfImageObject(value: unknown): value is PdfImageObject {
  if (!value || typeof value !== 'object') return false
  const obj = value as PdfImageObject
  return (
    typeof obj.width === 'number' &&
    obj.width > 0 &&
    typeof obj.height === 'number' &&
    obj.height > 0
  )
}

function toSourcePageSize(image: PdfImageObject): SourcePageSize {
  return { width: image.width!, height: image.height! }
}

function isFullPageScanImage(
  image: SourcePageSize,
  viewport: { width: number; height: number },
): boolean {
  const viewportAspect = viewport.width / viewport.height
  const imageAspect = image.width / image.height
  const aspectDrift =
    Math.abs(imageAspect - viewportAspect) / viewportAspect
  if (aspectDrift > FULL_PAGE_MAX_ASPECT_DRIFT) return false

  const expectedHeightAtFullWidth =
    image.width * (viewport.height / viewport.width)
  const expectedFullPageArea = image.width * expectedHeightAtFullWidth
  const coverage = (image.width * image.height) / expectedFullPageArea
  return coverage >= FULL_PAGE_MIN_COVERAGE
}

function imageUnitSquarePdfBBox(matrix: PdfMatrix): PdfImagePdfBBox {
  const corners: Array<[number, number]> = [
    Util.applyTransform(matrix, [0, 0]),
    Util.applyTransform(matrix, [1, 0]),
    Util.applyTransform(matrix, [0, 1]),
    Util.applyTransform(matrix, [1, 1]),
  ]

  const xs = corners.map(([x]) => x)
  const ys = corners.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

async function collectEmbeddedImagePlacements(
  page: PDFPageProxy,
): Promise<Array<PdfImagePlacement>> {
  let operatorList
  try {
    operatorList = await page.getOperatorList()
  } catch {
    return []
  }

  const { fnArray, argsArray } = operatorList
  const placements: Array<PdfImagePlacement> = []
  const matrixStack: Array<PdfMatrix> = [IDENTITY_MATRIX]
  let currentMatrix: PdfMatrix = [...IDENTITY_MATRIX]

  for (let i = 0; i < fnArray.length; i++) {
    const op = fnArray[i]
    const args = argsArray[i]

    if (op === OPS.save) {
      matrixStack.push([...currentMatrix])
      continue
    }

    if (op === OPS.restore) {
      currentMatrix = matrixStack.pop() ?? [...IDENTITY_MATRIX]
      continue
    }

    if (op === OPS.transform) {
      const transformMatrix = args as PdfMatrix
      currentMatrix = Util.transform(transformMatrix, currentMatrix)
      continue
    }

    if (
      op !== OPS.paintImageXObject &&
      op !== OPS.paintInlineImageXObject
    ) {
      continue
    }

    const imageName = args?.[0]
    if (imageName == null) continue

    try {
      const image: unknown = await page.objs.get(imageName)
      if (!isPdfImageObject(image)) continue
      placements.push({
        pixelSize: toSourcePageSize(image),
        pdfBBox: imageUnitSquarePdfBBox(currentMatrix),
      })
    } catch {
      // Image object may not be resolved yet.
    }
  }

  return placements
}

function pickLargestImageSize(
  sizes: Array<SourcePageSize>,
): SourcePageSize | null {
  let largest: SourcePageSize | null = null
  let largestArea = 0

  for (const size of sizes) {
    const area = size.width * size.height
    if (area > largestArea) {
      largestArea = area
      largest = size
    }
  }

  return largest
}

function pickFullPageImageSize(
  sizes: Array<SourcePageSize>,
  viewport: { width: number; height: number },
): SourcePageSize | null {
  let best: SourcePageSize | null = null
  let bestArea = 0

  for (const size of sizes) {
    if (!isFullPageScanImage(size, viewport)) continue
    const area = size.width * size.height
    if (area > bestArea) {
      bestArea = area
      best = size
    }
  }

  return best
}

function pickFullPageImagePlacement(
  placements: Array<PdfImagePlacement>,
  viewport: { width: number; height: number },
): PdfImagePlacement | null {
  let best: PdfImagePlacement | null = null
  let bestArea = 0

  for (const placement of placements) {
    if (!isFullPageScanImage(placement.pixelSize, viewport)) continue
    const area = placement.pixelSize.width * placement.pixelSize.height
    if (area > bestArea) {
      bestArea = area
      best = placement
    }
  }

  return best
}

/** Extract full-page scan pixels and largest embedded image for bbox coordinate mapping. */
export async function extractPageImageSizes(
  page: PDFPageProxy,
): Promise<PageImageSizes> {
  const viewport = page.getViewport({ scale: 1 })
  const placements = await collectEmbeddedImagePlacements(page)
  const sizes = placements.map((placement) => placement.pixelSize)

  return {
    fullPageImageSize: pickFullPageImageSize(sizes, viewport),
    largestImageSize: pickLargestImageSize(sizes),
    fullPageImagePlacement: pickFullPageImagePlacement(placements, viewport),
  }
}

/** @deprecated Prefer `extractPageImageSizes` for full-page vs DPI-inference split. */
export async function extractLargestPageImageSize(
  page: PDFPageProxy,
): Promise<SourcePageSize | null> {
  const { fullPageImageSize, largestImageSize } =
    await extractPageImageSizes(page)
  return fullPageImageSize ?? largestImageSize
}
