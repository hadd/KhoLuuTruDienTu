/**
 * Cheap structural check for an embedded PAdES/PKCS#7 signature dictionary.
 * Does not cryptographically verify — only detects signature presence so exporters
 * can avoid rewrite steps (PDF/A, watermark) that invalidate ByteRange.
 */
export function pdfLooksDigitallySigned(pdfBytes: Uint8Array): boolean {
  if (pdfBytes.byteLength < 32) return false;
  const text = new TextDecoder("latin1").decode(pdfBytes);
  return /\/ByteRange\s*\[/.test(text) && /\/Type\s*\/Sig\b/.test(text);
}
