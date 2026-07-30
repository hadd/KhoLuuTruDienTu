const HEADER_LEVEL = 'x-security-level-token'
const HEADER_LEVELS = 'x-security-level-tokens'
const HEADER_DOSSIER = 'x-dossier-access-token'
const HEADER_DOSSIERS = 'x-dossier-access-tokens'
const HEADER_FILES = 'x-file-access-tokens'

type StoredToken = {
  token: string
  expiresAt: number
}

const levelTokens = new Map<string, StoredToken>()
const dossierTokens = new Map<string, StoredToken>()
const fileTokens = new Map<string, StoredToken>()
const dossierLevelIds = new Map<string, string>()
const dossierUnlockedLevelIds = new Map<string, Set<string>>()
const dossierUnlockedFileIds = new Map<string, Set<string>>()

function isValid(entry: StoredToken | undefined): entry is StoredToken {
  return Boolean(entry && entry.expiresAt > Date.now() + 5_000)
}

function storeToken(
  map: Map<string, StoredToken>,
  key: string,
  token: string,
  expiresInSec: number,
) {
  if (!token || !token.trim()) return
  const ttlSec =
    Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec : 15 * 60
  map.set(key, {
    token,
    expiresAt: Date.now() + ttlSec * 1000,
  })
}

export function setSecurityLevelAccessToken(
  securityLevelId: string,
  token: string,
  expiresInSec: number,
) {
  storeToken(levelTokens, securityLevelId, token, expiresInSec)
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

export function rememberDossierUnlockedFile(
  dossierId: string,
  fileId: string | null | undefined,
) {
  if (!fileId) return
  const current = dossierUnlockedFileIds.get(dossierId) ?? new Set<string>()
  current.add(fileId)
  dossierUnlockedFileIds.set(dossierId, current)
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
  storeToken(dossierTokens, dossierId, token, expiresInSec)
}

export function setFileAccessToken(
  fileId: string,
  token: string,
  expiresInSec: number,
) {
  storeToken(fileTokens, fileId, token, expiresInSec)
}

export function clearSecurityLevelAccessToken(securityLevelId: string) {
  levelTokens.delete(securityLevelId)
}

export function clearDossierAccessToken(dossierId: string) {
  dossierTokens.delete(dossierId)
}

export function clearFileAccessToken(fileId: string) {
  fileTokens.delete(fileId)
}

/** Clear per-dossier unlock session, including level/file tokens unlocked while viewing that dossier. */
export function clearDossierAccessSession(dossierId: string) {
  const unlockedLevelIds = dossierUnlockedLevelIds.get(dossierId)
  for (const levelId of unlockedLevelIds ?? []) {
    clearSecurityLevelAccessToken(levelId)
  }
  const unlockedFileIds = dossierUnlockedFileIds.get(dossierId)
  for (const fileId of unlockedFileIds ?? []) {
    clearFileAccessToken(fileId)
  }
  clearDossierAccessToken(dossierId)
  dossierLevelIds.delete(dossierId)
  dossierUnlockedLevelIds.delete(dossierId)
  dossierUnlockedFileIds.delete(dossierId)
}

export function getSecurityLevelAccessToken(
  securityLevelId: string | null | undefined,
): string | undefined {
  if (!securityLevelId) return undefined
  const entry = levelTokens.get(securityLevelId)
  return isValid(entry) ? entry.token : undefined
}

export function getDossierAccessToken(
  dossierId: string | null | undefined,
): string | undefined {
  if (!dossierId) return undefined
  const entry = dossierTokens.get(dossierId)
  return isValid(entry) ? entry.token : undefined
}

export function getFileAccessToken(
  fileId: string | null | undefined,
): string | undefined {
  if (!fileId) return undefined
  const entry = fileTokens.get(fileId)
  return isValid(entry) ? entry.token : undefined
}

export function getAllValidSecurityLevelAccessTokens(): Array<string> {
  return [...levelTokens.values()].filter(isValid).map((entry) => entry.token)
}

export function getAllValidDossierAccessTokens(): Array<string> {
  return [...dossierTokens.values()].filter(isValid).map((entry) => entry.token)
}

export function getAllValidFileAccessTokens(): Array<string> {
  return [...fileTokens.values()].filter(isValid).map((entry) => entry.token)
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

  const allDossierTokens = getAllValidDossierAccessTokens()
  if (allDossierTokens.length > 0) {
    headers[HEADER_DOSSIERS] = allDossierTokens.join(',')
  }

  const allFileTokens = getAllValidFileAccessTokens()
  if (allFileTokens.length > 0) {
    headers[HEADER_FILES] = allFileTokens.join(',')
  }

  return headers
}

const LEVEL_REQUIRED_RE = /^PASSWORD_REQUIRED:level(?::([0-9a-f-]{36}))?/i
const DOSSIER_REQUIRED_RE = /^PASSWORD_REQUIRED:dossier(?::([0-9a-f-]{36}))?/i
const FILE_REQUIRED_RE =
  /^PASSWORD_REQUIRED:file(?::([0-9a-f-]{36}))(?::([0-9a-f-]{36}))?/i

export function parsePasswordRequiredError(message: string | undefined): {
  scope: 'level' | 'dossier' | 'file'
  securityLevelId?: string
  dossierId?: string
  fileId?: string
} | null {
  if (!message) return null
  const fileMatch = FILE_REQUIRED_RE.exec(message.trim())
  if (fileMatch) {
    return {
      scope: 'file',
      fileId: fileMatch[1],
      securityLevelId: fileMatch[2],
    }
  }
  const levelMatch = LEVEL_REQUIRED_RE.exec(message.trim())
  if (levelMatch) {
    return {
      scope: 'level',
      securityLevelId: levelMatch[1],
    }
  }
  const dossierMatch = DOSSIER_REQUIRED_RE.exec(message.trim())
  if (dossierMatch) {
    return { scope: 'dossier', dossierId: dossierMatch[1] }
  }
  return null
}

export {
  HEADER_LEVEL,
  HEADER_LEVELS,
  HEADER_DOSSIER,
  HEADER_DOSSIERS,
  HEADER_FILES,
}
