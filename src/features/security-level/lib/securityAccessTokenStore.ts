const HEADER_LEVEL = 'x-security-level-token'
const HEADER_LEVELS = 'x-security-level-tokens'
const HEADER_DOSSIER = 'x-dossier-access-token'

type StoredToken = {
  token: string
  expiresAt: number
}

const levelTokens = new Map<string, StoredToken>()
const dossierTokens = new Map<string, StoredToken>()
const dossierLevelIds = new Map<string, string>()
const dossierUnlockedLevelIds = new Map<string, Set<string>>()

function isValid(entry: StoredToken | undefined): entry is StoredToken {
  return Boolean(entry && entry.expiresAt > Date.now() + 5_000)
}

export function setSecurityLevelAccessToken(
  securityLevelId: string,
  token: string,
  expiresInSec: number,
) {
  if (!token || !token.trim()) return
  const ttlSec = Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec : 15 * 60
  levelTokens.set(securityLevelId, {
    token,
    expiresAt: Date.now() + ttlSec * 1000,
  })
}

export function rememberDossierSecurityLevel(
  dossierId: string,
  securityLevelId: string | null | undefined,
) {
  if (!securityLevelId) {
    dossierLevelIds.delete(dossierId)
    return
  }
  dossierLevelIds.set(dossierId, securityLevelId)
}

export function rememberDossierUnlockedSecurityLevel(
  dossierId: string,
  securityLevelId: string | null | undefined,
) {
  if (!securityLevelId) return
  const current = dossierUnlockedLevelIds.get(dossierId) ?? new Set<string>()
  current.add(securityLevelId)
  dossierUnlockedLevelIds.set(dossierId, current)
}

export function getRememberedDossierSecurityLevel(
  dossierId: string,
): string | undefined {
  return dossierLevelIds.get(dossierId)
}

export function setDossierAccessToken(
  dossierId: string,
  token: string,
  expiresInSec: number,
) {
  dossierTokens.set(dossierId, {
    token,
    expiresAt: Date.now() + expiresInSec * 1000,
  })
}

export function clearSecurityLevelAccessToken(securityLevelId: string) {
  levelTokens.delete(securityLevelId)
}

export function clearDossierAccessToken(dossierId: string) {
  dossierTokens.delete(dossierId)
}

/** Clear per-dossier unlock session, including any level tokens unlocked while viewing that dossier. */
export function clearDossierAccessSession(dossierId: string) {
  const unlockedLevelIds = dossierUnlockedLevelIds.get(dossierId)
  for (const levelId of unlockedLevelIds ?? []) {
    clearSecurityLevelAccessToken(levelId)
  }
  clearDossierAccessToken(dossierId)
  dossierLevelIds.delete(dossierId)
  dossierUnlockedLevelIds.delete(dossierId)
}

export function getSecurityLevelAccessToken(
  securityLevelId: string | null | undefined,
): string | undefined {
  if (!securityLevelId) return undefined
  const entry = levelTokens.get(securityLevelId)
  return isValid(entry) ? entry.token : undefined
}

export function getAllValidSecurityLevelAccessTokens(): Array<string> {
  return [...levelTokens.values()]
    .filter(isValid)
    .map((entry) => entry.token)
}

/** Attach stored access tokens for a known level / dossier context. */
export function buildSecurityAccessHeaders(input?: {
  securityLevelId?: string | null
  dossierId?: string | null
}): Record<string, string> {
  const headers: Record<string, string> = {}

  const rememberedLevelId = input?.dossierId
    ? getRememberedDossierSecurityLevel(input.dossierId)
    : undefined

  // Per-dossier remember (set after unlock) wins over stale React state level id.
  const levelId = rememberedLevelId ?? input?.securityLevelId ?? undefined
  const levelToken = getSecurityLevelAccessToken(levelId)
  if (levelToken) {
    headers[HEADER_LEVEL] = levelToken
  }

  const allLevelTokens = getAllValidSecurityLevelAccessTokens()
  if (allLevelTokens.length > 0) {
    headers[HEADER_LEVELS] = allLevelTokens.join(',')
  }

  if (input?.dossierId) {
    const dossierEntry = dossierTokens.get(input.dossierId)
    if (isValid(dossierEntry)) {
      headers[HEADER_DOSSIER] = dossierEntry.token
    }
  }

  return headers
}

const LEVEL_REQUIRED_RE = /^PASSWORD_REQUIRED:level(?::([0-9a-f-]{36}))?/i
const DOSSIER_REQUIRED_RE = /^PASSWORD_REQUIRED:dossier/i

export function parsePasswordRequiredError(message: string | undefined): {
  scope: 'level' | 'dossier'
  securityLevelId?: string
} | null {
  if (!message) return null
  const levelMatch = LEVEL_REQUIRED_RE.exec(message.trim())
  if (levelMatch) {
    return {
      scope: 'level',
      securityLevelId: levelMatch[1],
    }
  }
  if (DOSSIER_REQUIRED_RE.test(message.trim())) {
    return { scope: 'dossier' }
  }
  return null
}

export { HEADER_LEVEL, HEADER_LEVELS, HEADER_DOSSIER }
