import imageCompression from 'browser-image-compression'

export interface ImageCompressionOptions {
  /**
   * Maximum file size in MB after compression (default: 1.0 = 1MB)
   */
  maxSizeMB?: number
  /**
   * Maximum width or height in pixels (default: 1920)
   * Maintains aspect ratio
   */
  maxWidthOrHeight?: number
  /**
   * Image quality for JPEG (0-1, default: 0.8)
   * Only applies to JPEG format
   */
  quality?: number
  /**
   * Use Web Worker for compression (default: true)
   * Prevents UI blocking during compression
   */
  useWebWorker?: boolean
  /**
   * Whether to convert PNG to JPEG (default: false)
   * Smaller file size but loses transparency
   */
  convertToJpeg?: boolean
}

/**
 * Default compression options optimized for question images
 * Images should not exceed 1MB after compression
 */
const DEFAULT_OPTIONS: Required<ImageCompressionOptions> = {
  maxSizeMB: 1.0, // 1MB maximum
  maxWidthOrHeight: 1920,
  quality: 0.8,
  useWebWorker: true,
  convertToJpeg: false,
}

/**
 * Check if file is an SVG (text-based, needs special handling)
 */
function isSVG(file: File): boolean {
  return (
    file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
  )
}

/**
 * Get image dimensions from a File object
 * @param file - Image file to get dimensions from
 * @returns Promise resolving to width and height, or default dimensions if detection fails
 */
async function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.width, height: img.height })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      // Return default dimensions if detection fails
      resolve({ width: 1920, height: 1080 })
    }

    img.src = url
  })
}

/**
 * Get maximum file size (in MB) based on image width
 * Maps width ranges to appropriate max file sizes
 * @param width - Image width in pixels
 * @returns Maximum file size in MB
 */
function getMaxSizeForWidth(width: number): number {
  if (width < 800) {
    return 0.5 // 500KB for small images
  } else if (width <= 1920) {
    return 1.0 // 1MB for medium images
  } else {
    return 1.5 // 1.5MB for large images (though they'll be resized to 1920px max)
  }
}

/**
 * Optimize SVG by removing unnecessary elements and whitespace
 * This is a basic optimization - full SVG optimization would require a library
 */
async function optimizeSVG(file: File): Promise<File> {
  const text = await file.text()

  // Basic optimizations:
  // 1. Remove comments
  // 2. Remove unnecessary whitespace
  // 3. Remove empty lines
  const optimized = text
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/>\s+</g, '><') // Remove whitespace between tags
    .trim()

  // If optimization reduced size, return new file
  if (optimized.length < text.length) {
    return new File([optimized], file.name, { type: 'image/svg+xml' })
  }

  return file
}

/**
 * Compress image file based on its type
 *
 * @param file - Image file to compress
 * @param options - Compression options
 * @returns Compressed file (or original if compression not applicable)
 *
 * @example
 * const compressed = await compressImage(file, { maxSizeMB: 1.0 })
 */
export async function compressImage(
  file: File,
  options?: ImageCompressionOptions,
): Promise<File> {
  // SVG: Use text-based optimization (don't use canvas compression)
  if (isSVG(file)) {
    return optimizeSVG(file)
  }

  // PNG/JPEG/WebP: Use browser-image-compression
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // If maxSizeMB not explicitly provided, detect image dimensions and calculate based on width
  if (options?.maxSizeMB === undefined) {
    try {
      const dimensions = await getImageDimensions(file)
      opts.maxSizeMB = getMaxSizeForWidth(dimensions.width)
    } catch (error) {
      console.warn(
        'Failed to detect image dimensions, using default maxSizeMB:',
        error,
      )
      // Keep default maxSizeMB from DEFAULT_OPTIONS
    }
  }

  try {
    // Compress with target size limit
    let compressed = await imageCompression(file, {
      maxSizeMB: opts.maxSizeMB,
      maxWidthOrHeight: opts.maxWidthOrHeight,
      useWebWorker: opts.useWebWorker,
      fileType: opts.convertToJpeg ? 'image/jpeg' : undefined,
      initialQuality: opts.quality,
    })

    // If still over limit, reduce quality progressively
    const maxSizeBytes = opts.maxSizeMB * 1024 * 1024
    if (compressed.size > maxSizeBytes) {
      let quality = opts.quality
      while (compressed.size > maxSizeBytes && quality > 0.3) {
        quality -= 0.1
        compressed = await imageCompression(file, {
          maxSizeMB: opts.maxSizeMB,
          maxWidthOrHeight: opts.maxWidthOrHeight,
          useWebWorker: opts.useWebWorker,
          fileType: opts.convertToJpeg ? 'image/jpeg' : undefined,
          initialQuality: quality,
        })
      }
    }

    return compressed
  } catch (error) {
    console.warn('Image compression failed, using original file:', error)
    return file
  }
}

/**
 * Check if file should be compressed
 * Always compress image files for optimization, regardless of size
 * Small images can benefit from compression for optimization purposes
 */
export function shouldCompress(file: File): boolean {
  // Only compress image files
  return file.type.startsWith('image/')
}
