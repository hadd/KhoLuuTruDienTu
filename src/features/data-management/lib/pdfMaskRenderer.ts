/**
 * Renders a pixelated (mosaic) copy of a PDF page canvas.
 * Used for editor mask overlay — similar to broadcast-style pixelation.
 */
export function renderMosaicFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  blockSize: number,
): HTMLCanvasElement {
  const { width, height } = sourceCanvas
  const safeBlockSize = Math.max(2, Math.round(blockSize))

  const output = document.createElement('canvas')
  output.width = width
  output.height = height

  const smallWidth = Math.max(1, Math.ceil(width / safeBlockSize))
  const smallHeight = Math.max(1, Math.ceil(height / safeBlockSize))

  const downscale = document.createElement('canvas')
  downscale.width = smallWidth
  downscale.height = smallHeight
  const downscaleCtx = downscale.getContext('2d')
  if (!downscaleCtx) return output

  downscaleCtx.drawImage(sourceCanvas, 0, 0, smallWidth, smallHeight)

  const outputCtx = output.getContext('2d')
  if (!outputCtx) return output

  outputCtx.imageSmoothingEnabled = false
  outputCtx.drawImage(
    downscale,
    0,
    0,
    smallWidth,
    smallHeight,
    0,
    0,
    width,
    height,
  )

  return output
}
