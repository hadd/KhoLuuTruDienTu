import { sanitizePathSegment } from '@/features/scan-intake/lib/sanitizePathSegment'

export function buildInboxPdfFileName(
  docSlug: string,
  displayName?: string,
): string {
  const base = displayName?.trim()
    ? sanitizePathSegment(displayName)
    : sanitizePathSegment(docSlug)
  return `${base}.pdf`
}

export function buildInboxPdfKey(
  workspace: string,
  sessionId: string,
  docSlug: string,
  displayName?: string,
): string {
  const slug = sanitizePathSegment(docSlug)
  return `scan-draft/${workspace}/${sessionId}/inbox/${slug}/${buildInboxPdfFileName(docSlug, displayName)}`
}
