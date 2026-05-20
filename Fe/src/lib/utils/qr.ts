import bwipjs from 'bwip-js'

/**
 * Generate a standard QR code as a base64 data URL
 * @param data - The data to encode in the QR code
 * @param options - Optional configuration
 * @param options.size - Size of the QR code in pixels (default: 200)
 * @returns Base64 data URL of the QR code image
 */
export function generateQRCode(
  data: string,
  options?: { size?: number },
): string {
  const size = options?.size ?? 200

  try {
    // Create a canvas element
    const canvas = document.createElement('canvas')
    const scale = 2 // Higher scale for better quality
    const actualSize = size * scale

    // Generate QR code using bwip-js
    bwipjs.toCanvas(canvas, {
      bcid: 'qrcode', // Barcode type: QR Code
      text: data,
      scale: scale,
      width: actualSize,
      height: actualSize,
      includetext: false, // Don't include text below QR code
      backgroundcolor: 'FFFFFF', // White background
      barcolor: '000000', // Black bars
    })

    // Convert canvas to data URL
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Error generating QR code:', error)
    // Return empty data URL as fallback
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }
}

/**
 * Generate a micro QR code as a base64 data URL
 * Micro QR codes are smaller and suitable for limited space
 * @param data - The data to encode in the QR code
 * @param options - Optional configuration
 * @param options.size - Size of the QR code in pixels (default: 100)
 * @returns Base64 data URL of the QR code image
 */
export function generateMicroQRCode(
  data: string,
  options?: { size?: number },
): string {
  const size = options?.size ?? 100

  try {
    // Create a canvas element
    const canvas = document.createElement('canvas')
    const scale = 2 // Higher scale for better quality
    const actualSize = size * scale

    // Generate micro QR code using bwip-js
    bwipjs.toCanvas(canvas, {
      bcid: 'microqrcode', // Barcode type: Micro QR Code
      text: data,
      scale: scale,
      width: actualSize,
      height: actualSize,
      includetext: false, // Don't include text below QR code
      backgroundcolor: 'FFFFFF', // White background
      barcolor: '000000', // Black bars
    })

    // Convert canvas to data URL
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Error generating micro QR code:', error)
    // Return empty data URL as fallback
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }
}
