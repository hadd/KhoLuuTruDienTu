const KEY_PREFIX = 'fsi.archive-warehouse.manageByFond'

function storageKey(userId: string) {
  return `${KEY_PREFIX}:${userId}`
}

/** Default true — matches URL semantics where omit means enabled. */
export function readManageByFondPreference(userId: string | undefined): boolean {
  if (!userId || typeof window === 'undefined') return true
  const raw = window.localStorage.getItem(storageKey(userId))
  if (raw === 'false') return false
  if (raw === 'true') return true
  return true
}

export function writeManageByFondPreference(
  userId: string | undefined,
  value: boolean,
) {
  if (!userId || typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(userId), String(value))
}
