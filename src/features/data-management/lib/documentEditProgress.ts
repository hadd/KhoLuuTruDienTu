const STORAGE_PREFIX = 'dm-doc-edit-progress:'

function storageKey(dossierId: string): string {
  return `${STORAGE_PREFIX}${dossierId}`
}

export function loadCompletedDocumentIds(dossierId: string): Set<string> {
  const id = dossierId.trim()
  if (!id || typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(storageKey(id))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed.filter((item): item is string => typeof item === 'string' && item.trim()),
    )
  } catch {
    return new Set()
  }
}

export function saveCompletedDocumentIds(
  dossierId: string,
  documentIds: Set<string>,
): void {
  const id = dossierId.trim()
  if (!id || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      storageKey(id),
      JSON.stringify([...documentIds]),
    )
  } catch {
    // ignore quota / private mode
  }
}

export function clearCompletedDocumentIds(dossierId: string): void {
  const id = dossierId.trim()
  if (!id || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey(id))
  } catch {
    // ignore
  }
}
