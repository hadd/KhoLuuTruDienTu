import type { DataTreeNodeT } from '@/features/data-management/types'

const RAW_ANCHOR = 'raw/'

function stripSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, '')
}

/** "raw/abc" | "/raw/parent/child" → "abc" | "parent/child" (sau anchor raw) */
export function folderPathToStoragePrefix(folderPath: string): string {
  let normalized = folderPath.trim()
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1)
  }

  const lower = normalized.toLowerCase()
  if (lower.startsWith(RAW_ANCHOR)) {
    normalized = normalized.slice(RAW_ANCHOR.length)
  } else if (lower === 'raw') {
    normalized = ''
  }

  return stripSlashes(normalized)
}

/** "218_CD/a.pdf" + prefix "abc" → "abc/218_CD/a.pdf" */
export function applyStoragePathPrefix(
  relativePath: string,
  storagePathPrefix?: string,
): string {
  const trimmed = relativePath.replace(/^\/+/, '')
  const prefix = storagePathPrefix?.trim()
  if (!prefix) return trimmed

  const normalizedPrefix = stripSlashes(prefix)
  if (!normalizedPrefix) return trimmed

  return `${normalizedPrefix}/${trimmed}`
}

/** Resolve MinIO prefix for uploading PDFs into an existing dossier (record). */
export function resolveRecordStoragePrefix(
  record: DataTreeNodeT,
): string | undefined {
  if (record.folderPath?.trim()) {
    return folderPathToStoragePrefix(record.folderPath)
  }

  const firstDoc = record.children.find(
    (child) => child.type === 'document' && child.filePath?.trim(),
  )
  if (!firstDoc?.filePath) return undefined

  let normalized = firstDoc.filePath.trim()
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1)
  }

  const lower = normalized.toLowerCase()
  if (lower.startsWith(RAW_ANCHOR)) {
    normalized = normalized.slice(RAW_ANCHOR.length)
  } else if (lower === 'raw') {
    normalized = ''
  }

  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash < 0) return undefined

  const parentPath = stripSlashes(normalized.slice(0, lastSlash))
  return parentPath || undefined
}
