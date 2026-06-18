import { env } from '@/lib/utils/env'

/**
 * PDF editor mask (censor) settings for the original document layer.
 * Configure via .env: VITE_PDF_MASK_TYPE, VITE_PDF_MASK_GAUSSIAN_BLUR_PX, VITE_PDF_MASK_MOSAIC_BLOCK_SIZE
 */
export type PdfMaskType = 'gaussian' | 'mosaic'

export interface PdfMaskConfig {
  /** Blur style: gaussian (soft blur) or mosaic (pixelation). */
  type: PdfMaskType
  /** Gaussian blur radius in CSS pixels. Higher = stronger blur. */
  gaussianBlurPx: number
  /** Mosaic block size in pixels. Higher = coarser pixelation. */
  mosaicBlockSize: number
}

export const pdfMaskConfig: PdfMaskConfig = {
  type: env.PDF_MASK_TYPE,
  gaussianBlurPx: env.PDF_MASK_GAUSSIAN_BLUR_PX,
  mosaicBlockSize: env.PDF_MASK_MOSAIC_BLOCK_SIZE,
}
