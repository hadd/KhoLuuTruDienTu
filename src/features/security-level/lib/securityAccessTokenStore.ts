const HEADER_LEVEL = 'x-security-level-token'
const HEADER_LEVELS = 'x-security-level-tokens'
const HEADER_DOSSIER = 'x-dossier-access-token'
const HEADER_DOSSIERS = 'x-dossier-access-tokens'
const HEADER_FILES = 'x-file-access-tokens'

export type SecurityAccessModule = 'warehouse' | 'exploitation'

type StoredToken = {
  token: string
  expiresAt: number
}

type ModuleMaps = {
  levelTokens: Map<string, StoredToken>
  dossierTokens: Map<string, StoredToken>
  fileTokens: Map<string, StoredToken>
  dossierLevelIds: Map<string, string>
  dossierUnlockedLevelIds: Map<string, Set<string>>
  dossierUnlockedFileIds: Map<string, Set<string>>
}

const modules = new Map<SecurityAccessModule, ModuleMaps>()

function createModuleMaps(): ModuleMaps {
  return {
    levelTokens: new Map(),
    dossierTokens: new Map(),
    fileTokens: new Map(),
    dossierLevelIds: new Map(),
    dossierUnlockedLevelIds: new Map(),
    dossierUnlockedFileIds: new Map(),
  }
}

function mapsFor(module: SecurityAccessModule): ModuleMaps {
  let maps = modules.get(module)
  if (!maps) {
    maps = createModuleMaps()
    modules.set(module, maps)
  }
  return maps
}

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
  module: SecurityAccessModule,
  securityLevelId: string,
  token: string,
  expiresInSec: number,
) {
  storeToken(mapsFor(module).levelTokens, securityLevelId, token, expiresInSec)
}

export function rememberDossierSecurityLevel(
  module: SecurityAccessModule,
  dossierId: string,
  securityLevelId: string | null | undefined,
) {
  const { dossierLevelIds } = mapsFor(module)
  if (!securityLevelId) {
    dossierLevelIds.delete(dossierId)
    return
  }
  dossierLevelIds.set(dossierId, securityLevelId)
}

export function rememberDossierUnlockedSecurityLevel(
  module: SecurityAccessModule,
  dossierId: string,
  securityLevelId: string | null | undefined,
) {
  if (!securityLevelId) return
  const { dossierUnlockedLevelIds } = mapsFor(module)
  const current = dossierUnlockedLevelIds.get(dossierId) ?? new Set<string>()
  current.add(securityLevelId)
  dossierUnlockedLevelIds.set(dossierId, current)
}

export function rememberDossierUnlockedFile(
  module: SecurityAccessModule,
  dossierId: string,
  fileId: string | null | undefined,
) {
  if (!fileId) return
  const { dossierUnlockedFileIds } = mapsFor(module)
  const current = dossierUnlockedFileIds.get(dossierId) ?? new Set<string>()
  current.add(fileId)
  dossierUnlockedFileIds.set(dossierId, current)
}

export function getRememberedDossierSecurityLevel(
  module: SecurityAccessModule,
  dossierId: string,
): string | undefined {
  return mapsFor(module).dossierLevelIds.get(dossierId)
}

export function setDossierAccessToken(
  module: SecurityAccessModule,
  dossierId: string,
  token: string,
  expiresInSec: number,
) {
  storeToken(mapsFor(module).dossierTokens, dossierId, token, expiresInSec)
}

export function setFileAccessToken(
  module: SecurityAccessModule,
  fileId: string,
  token: string,
  expiresInSec: number,
) {
  storeToken(mapsFor(module).fileTokens, fileId, token, expiresInSec)
}

export function clearSecurityLevelAccessToken(
  module: SecurityAccessModule,
  securityLevelId: string,
) {
  mapsFor(module).levelTokens.delete(securityLevelId)
}

export function clearDossierAccessToken(
  module: SecurityAccessModule,
  dossierId: string,
) {
  mapsFor(module).dossierTokens.delete(dossierId)
}

export function clearFileAccessToken(
  module: SecurityAccessModule,
  fileId: string,
) {
  mapsFor(module).fileTokens.delete(fileId)
}

/** Clear per-dossier unlock session, including level/file tokens unlocked while viewing that dossier. */
export function clearDossierAccessSession(
  module: SecurityAccessModule,
  dossierId: string,
) {
  const maps = mapsFor(module)
  const unlockedLevelIds = maps.dossierUnlockedLevelIds.get(dossierId)
  for (const levelId of unlockedLevelIds ?? []) {
    clearSecurityLevelAccessToken(module, levelId)
  }
  const unlockedFileIds = maps.dossierUnlockedFileIds.get(dossierId)
  for (const fileId of unlockedFileIds ?? []) {
    clearFileAccessToken(module, fileId)
  }
  clearDossierAccessToken(module, dossierId)
  maps.dossierLevelIds.delete(dossierId)
  maps.dossierUnlockedLevelIds.delete(dossierId)
  maps.dossierUnlockedFileIds.delete(dossierId)
}

/** Clear every in-memory security unlock token (logout / account switch). */
export function clearAllSecurityAccessTokens() {
  modules.clear()
}

export function getSecurityLevelAccessToken(
  module: SecurityAccessModule,
  securityLevelId: string | null | undefined,
): string | undefined {
  if (!securityLevelId) return undefined
  const entry = mapsFor(module).levelTokens.get(securityLevelId)
  return isValid(entry) ? entry.token : undefined
}

export function getDossierAccessToken(
  module: SecurityAccessModule,
  dossierId: string | null | undefined,
): string | undefined {
  if (!dossierId) return undefined
  const entry = mapsFor(module).dossierTokens.get(dossierId)
  return isValid(entry) ? entry.token : undefined
}

export function getFileAccessToken(
  module: SecurityAccessModule,
  fileId: string | null | undefined,
): string | undefined {
  if (!fileId) return undefined
  const entry = mapsFor(module).fileTokens.get(fileId)
  return isValid(entry) ? entry.token : undefined
}

export function getAllValidSecurityLevelAccessTokens(
  module: SecurityAccessModule,
): Array<string> {
  return [...mapsFor(module).levelTokens.values()]
    .filter(isValid)
    .map((entry) => entry.token)
}

export function getAllValidDossierAccessTokens(
  module: SecurityAccessModule,
): Array<string> {
  return [...mapsFor(module).dossierTokens.values()]
    .filter(isValid)
    .map((entry) => entry.token)
}

export function getAllValidFileAccessTokens(
  module: SecurityAccessModule,
): Array<string> {
  return [...mapsFor(module).fileTokens.values()]
    .filter(isValid)
    .map((entry) => entry.token)
}

/** Attach stored access tokens for a known module / level / dossier context. */
export function buildSecurityAccessHeaders(input?: {
  module?: SecurityAccessModule | null
  securityLevelId?: string | null
  dossierId?: string | null
}): Record<string, string> {
  const module = input?.module
  if (!module) return {}

  const headers: Record<string, string> = {}
  const maps = mapsFor(module)

  const rememberedLevelId = input?.dossierId
    ? getRememberedDossierSecurityLevel(module, input.dossierId)
    : undefined

  // Per-dossier remember (set after unlock) wins over stale React state level id.
  const levelId = rememberedLevelId ?? input?.securityLevelId ?? undefined
  const levelToken = getSecurityLevelAccessToken(module, levelId)
  if (levelToken) {
    headers[HEADER_LEVEL] = levelToken
  }

  const allLevelTokens = getAllValidSecurityLevelAccessTokens(module)
  if (allLevelTokens.length > 0) {
    headers[HEADER_LEVELS] = allLevelTokens.join(',')
  }

  if (input?.dossierId) {
    const dossierEntry = maps.dossierTokens.get(input.dossierId)
    if (isValid(dossierEntry)) {
      headers[HEADER_DOSSIER] = dossierEntry.token
    }
  }

  const allDossierTokens = getAllValidDossierAccessTokens(module)
  if (allDossierTokens.length > 0) {
    headers[HEADER_DOSSIERS] = allDossierTokens.join(',')
  }

  const allFileTokens = getAllValidFileAccessTokens(module)
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
