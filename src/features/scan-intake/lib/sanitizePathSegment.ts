/** Safe S3 / storage path segment from user-visible name. */
export function sanitizePathSegment(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'untitled'

  return trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 120) || 'untitled'
}
