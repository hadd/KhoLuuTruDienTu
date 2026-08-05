import type { CaCertificate } from '@/lib/ca-sign/ca-types'

const UUID_CN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function extractCn(subject: string): string {
  const match = subject.match(/(?:^|,)\s*CN\s*=\s*([^,]+)/i)
  if (match?.[1]) return match[1].trim().replace(/^"|"$/g, '')
  return subject.trim()
}

/** Junk / local-dev certs that should never appear in signing UI. */
export function isJunkSigningCertificate(cert: CaCertificate): boolean {
  const subject = (cert.subject ?? '').trim()
  const issuer = (cert.issuer ?? '').trim()
  const cn = extractCn(subject)
  const cnLower = cn.toLowerCase()
  const subjectLower = subject.toLowerCase()
  const issuerLower = issuer.toLowerCase()

  if (!cn) return true
  if (cnLower === 'localhost' || cnLower === '127.0.0.1') return true
  if (subjectLower.includes('cn=localhost')) return true
  if (issuerLower.includes('cn=localhost')) return true
  if (UUID_CN_RE.test(cn)) return true
  // Machine / IIS / Docker junk often looks like short hostnames without org
  if (/^(localhost|desktop-|laptop-)/i.test(cn)) return true

  return false
}

export function filterSigningCertificates(
  certs: Array<CaCertificate>,
): Array<CaCertificate> {
  return certs.filter((cert) => !isJunkSigningCertificate(cert))
}

/** Short label for dropdown — CN only, truncated to avoid layout jump. */
export function formatCertificateLabel(
  cert: CaCertificate,
  maxLen = 48,
): string {
  const cn = extractCn(cert.subject) || cert.thumbprint.slice(0, 12)
  const provider = cert.providerId ? `[${cert.providerId.toUpperCase()}] ` : ''
  const text = cn.length > maxLen ? `${cn.slice(0, maxLen - 1)}…` : cn
  return `${provider}${text}`
}

export function formatCertificateCn(subject: string): string {
  return extractCn(subject)
}
