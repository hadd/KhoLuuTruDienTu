import { generateMicroQRCode } from './qr'

/**
 * Cache for micro QR codes (used for question numbers)
 * Key format: `${data}-${size}` (e.g., "1-30", "12a-30")
 * Value: base64 data URL
 */
const microQRCodeCache = new Map<string, string>()

/**
 * Generate a cached micro QR code
 * For question labels (e.g. "1", "12", or sub-questions "4a", "4b"), this ensures
 * QR codes are only generated once and reused
 *
 * @param data - The data to encode (display label: main number or sub-label like "4a")
 * @param options - Optional configuration
 * @param options.size - Size of the QR code in pixels (default: 100)
 * @returns Base64 data URL of the QR code image (cached)
 */
export function generateCachedMicroQRCode(
  data: string,
  options?: { size?: number },
): string {
  const size = options?.size ?? 100
  const cacheKey = `${data}-${size}`

  // Return cached QR code if available
  if (microQRCodeCache.has(cacheKey)) {
    return microQRCodeCache.get(cacheKey)!
  }

  // Generate new QR code and cache it
  const qrCodeDataUrl = generateMicroQRCode(data, options)
  microQRCodeCache.set(cacheKey, qrCodeDataUrl)

  return qrCodeDataUrl
}

/**
 * Clear the QR code cache (useful for testing or memory management)
 */
export function clearQRCodeCache(): void {
  microQRCodeCache.clear()
}
