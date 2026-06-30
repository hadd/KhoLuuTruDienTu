import type { ScanPageRotationT } from '@/features/document-scan/types'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = src
  })
}

export async function transformScanPageImage(
  imageSrc: string,
  rotation: ScanPageRotationT,
  scale: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const image = await loadImage(imageSrc)
  const radians = (rotation * Math.PI) / 180
  const scaledWidth = image.width * scale
  const scaledHeight = image.height * scale
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas context unavailable')
  }

  const isVertical = rotation === 90 || rotation === 270
  canvas.width = isVertical ? scaledHeight : scaledWidth
  canvas.height = isVertical ? scaledWidth : scaledHeight

  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(radians)
  context.drawImage(
    image,
    -scaledWidth / 2,
    -scaledHeight / 2,
    scaledWidth,
    scaledHeight,
  )

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width: canvas.width,
    height: canvas.height,
  }
}
