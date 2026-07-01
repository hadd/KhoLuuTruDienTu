import { sanitizePathSegment } from '@/features/scan-intake/lib/sanitizePathSegment'

/** Sanitize a nested folder path (segments joined by `/`). */
export function sanitizeFolderPath(path: string): string {
  return path
    .split('/')
    .map((segment) => sanitizePathSegment(segment))
    .filter(Boolean)
    .join('/')
}

export function joinFolderPath(parentPath: string | undefined, name: string): string {
  const segment = sanitizePathSegment(name)
  if (!parentPath) return segment
  return `${sanitizeFolderPath(parentPath)}/${segment}`
}

export function formatFolderSegment(segment: string): string {
  return segment.replace(/_/g, ' ')
}

export function formatFolderPath(path: string): string {
  return path.split('/').map(formatFolderSegment).join(' / ')
}
