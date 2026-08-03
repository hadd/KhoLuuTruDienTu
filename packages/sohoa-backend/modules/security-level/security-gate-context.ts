import { and, inArray, isNull } from "drizzle-orm"
import { httpError } from "@shared/common-lib"
import { db } from "../../db/db-conn.ts"
import { dossiers } from "../../db/schemas/dossier.ts"
import { dossierFiles } from "../../db/schemas/dossier-file.ts"
import { securityLevels } from "../../db/schemas/security-level.ts"
import { securityLevelRules } from "../../db/schemas/security-level-rule.ts"
import {
  listActiveLevelsOrdered,
  listAllRuleKeys,
  type ResolvedRule,
} from "./security-clearance.ts"
import {
  FlagRuleKey,
  PermissionRuleKey,
  SYSTEM_DEFAULT_RULE_VALUES,
  SYSTEM_PERMISSION_DEFS,
  permissionRuleKey,
} from "./security-rule-keys.ts"
import type { PasswordSource } from "./security-access-token.ts"
import { verifySecurityAccessToken } from "./security-access-token.ts"

type LevelSummary = {
  id: string
  name: string
  levelOrder: number
}

type RulesFoundation = {
  levels: LevelSummary[]
  ruleKeys: string[]
  byLevel: Map<string, Map<string, { isOverridden: boolean; value: unknown }>>
}

function resolveRulesFromFoundation(
  foundation: RulesFoundation,
  securityLevelId: string,
): ResolvedRule[] {
  const targetIdx = foundation.levels.findIndex((l) => l.id === securityLevelId)
  if (targetIdx < 0) {
    throw httpError.notFound(
      "Cấp độ bảo mật không tồn tại hoặc không hoạt động.",
    )
  }

  const isLowest = targetIdx === 0
  const { byLevel, ruleKeys, levels } = foundation

  return ruleKeys.map((ruleKey) => {
    for (let i = targetIdx; i >= 0; i--) {
      const level = levels[i]!
      const row = byLevel.get(level.id)?.get(ruleKey)
      const atTarget = i === targetIdx

      if (i === 0) {
        const value = row
          ? row.value
          : (SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false)
        return {
          ruleKey,
          effectiveValue: value,
          isOverridden: atTarget,
          inheritedFromLevelId: atTarget ? null : level.id,
          inheritedFromLevelName: atTarget ? null : level.name,
          isLowestLevel: isLowest,
        }
      }

      if (row?.isOverridden) {
        return {
          ruleKey,
          effectiveValue: row.value,
          isOverridden: atTarget,
          inheritedFromLevelId: atTarget ? null : level.id,
          inheritedFromLevelName: atTarget ? null : level.name,
          isLowestLevel: isLowest,
        }
      }
    }

    return {
      ruleKey,
      effectiveValue: SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false,
      isOverridden: false,
      inheritedFromLevelId: null,
      inheritedFromLevelName: null,
      isLowestLevel: isLowest,
    }
  })
}

export type LevelCredential = {
  id: string
  passwordHash: string | null
  passwordVersion: number
  filePasswordHash: string | null
  filePasswordVersion: number
}

export type DossierGateInfo = {
  id: string
  securityLevelId: string | null
  accessPasswordEnabled: boolean
  accessPasswordHash: string | null
  passwordVersion: number
}

export type FileGateInfo = {
  id: string
  dossierId: string
  securityLevelId: string | null
  accessPasswordEnabled: boolean
  accessPasswordHash: string | null
  passwordVersion: number
  fileName?: string
  filePath?: string
}

/**
 * Request-scoped cache: nạp levels/rules/credentials một lần, evaluate gate trong bộ nhớ.
 */
export class SecurityRequestCache {
  private foundationPromise: Promise<RulesFoundation> | null = null
  private rulesByLevelId = new Map<string, ResolvedRule[]>()
  private boolByKey = new Map<string, boolean>()
  private levelCredentials = new Map<string, LevelCredential>()
  private dossiers = new Map<string, DossierGateInfo>()
  private files = new Map<string, FileGateInfo>()

  private async loadFoundation(): Promise<RulesFoundation> {
    if (!this.foundationPromise) {
      this.foundationPromise = (async () => {
        const [levels, ruleKeys] = await Promise.all([
          listActiveLevelsOrdered(),
          listAllRuleKeys(),
        ])
        const levelIds = levels.map((level) => level.id)
        const rows =
          levelIds.length > 0
            ? await db
              .select({
                securityLevelId: securityLevelRules.securityLevelId,
                ruleKey: securityLevelRules.ruleKey,
                isOverridden: securityLevelRules.isOverridden,
                value: securityLevelRules.value,
              })
              .from(securityLevelRules)
              .where(inArray(securityLevelRules.securityLevelId, levelIds))
            : []

        const byLevel = new Map<
          string,
          Map<string, { isOverridden: boolean; value: unknown }>
        >()
        for (const row of rows) {
          let map = byLevel.get(row.securityLevelId)
          if (!map) {
            map = new Map()
            byLevel.set(row.securityLevelId, map)
          }
          map.set(row.ruleKey, {
            isOverridden: row.isOverridden,
            value: row.value,
          })
        }

        return {
          levels: levels.map((level) => ({
            id: level.id,
            name: level.name,
            levelOrder: level.levelOrder,
          })),
          ruleKeys,
          byLevel,
        }
      })()
    }
    return this.foundationPromise
  }

  async getLowestLevelId(): Promise<string | null> {
    const foundation = await this.loadFoundation()
    return foundation.levels[0]?.id ?? null
  }

  async getRules(levelId: string): Promise<ResolvedRule[]> {
    const cached = this.rulesByLevelId.get(levelId)
    if (cached) return cached
    const foundation = await this.loadFoundation()
    const rules = resolveRulesFromFoundation(foundation, levelId)
    this.rulesByLevelId.set(levelId, rules)
    return rules
  }

  async getEffectiveBool(levelId: string, ruleKey: string): Promise<boolean> {
    const cacheKey = `${levelId}::${ruleKey}`
    if (this.boolByKey.has(cacheKey)) {
      return this.boolByKey.get(cacheKey)!
    }
    const rules = await this.getRules(levelId)
    const value = Boolean(
      rules.find((rule) => rule.ruleKey === ruleKey)?.effectiveValue,
    )
    this.boolByKey.set(cacheKey, value)
    return value
  }

  async preloadRules(levelIds: Array<string | null | undefined>): Promise<void> {
    const unique = [...new Set(levelIds.filter((id): id is string => Boolean(id)))]
    if (unique.length === 0) {
      await this.loadFoundation()
      return
    }
    await Promise.all(unique.map((id) => this.getRules(id)))
  }

  async loadLevelCredentials(levelIds: Array<string | null | undefined>): Promise<void> {
    const missing = [...new Set(
      levelIds.filter(
        (id): id is string =>
          typeof id === "string" &&
          id.length > 0 &&
          !this.levelCredentials.has(id),
      ),
    )]
    if (missing.length === 0) return

    const rows = await db
      .select({
        id: securityLevels.id,
        passwordHash: securityLevels.passwordHash,
        passwordVersion: securityLevels.passwordVersion,
        filePasswordHash: securityLevels.filePasswordHash,
        filePasswordVersion: securityLevels.filePasswordVersion,
      })
      .from(securityLevels)
      .where(inArray(securityLevels.id, missing))

    for (const row of rows) {
      this.levelCredentials.set(row.id, {
        id: row.id,
        passwordHash: row.passwordHash ?? null,
        passwordVersion: row.passwordVersion ?? 1,
        filePasswordHash: row.filePasswordHash ?? null,
        filePasswordVersion: row.filePasswordVersion ?? 1,
      })
    }
  }

  getLevelCredential(levelId: string): LevelCredential | undefined {
    return this.levelCredentials.get(levelId)
  }

  seedLevelCredential(info: LevelCredential): void {
    this.levelCredentials.set(info.id, info)
  }

  async loadDossiers(dossierIds: string[]): Promise<void> {
    const missing = [...new Set(
      dossierIds.filter((id) => id && !this.dossiers.has(id)),
    )]
    if (missing.length === 0) return

    const rows = await db
      .select({
        id: dossiers.id,
        securityLevelId: dossiers.securityLevelId,
        accessPasswordEnabled: dossiers.accessPasswordEnabled,
        accessPasswordHash: dossiers.accessPasswordHash,
        passwordVersion: dossiers.passwordVersion,
      })
      .from(dossiers)
      .where(and(inArray(dossiers.id, missing), isNull(dossiers.deletedAt)))

    for (const row of rows) {
      this.dossiers.set(row.id, {
        id: row.id,
        securityLevelId: row.securityLevelId,
        accessPasswordEnabled: row.accessPasswordEnabled,
        accessPasswordHash: row.accessPasswordHash ?? null,
        passwordVersion: row.passwordVersion ?? 1,
      })
    }
  }

  seedDossier(info: DossierGateInfo): void {
    this.dossiers.set(info.id, info)
  }

  getDossier(dossierId: string): DossierGateInfo | undefined {
    return this.dossiers.get(dossierId)
  }

  async loadFiles(fileIds: string[]): Promise<void> {
    const missing = [...new Set(
      fileIds.filter((id) => id && !this.files.has(id)),
    )]
    if (missing.length === 0) return

    const rows = await db
      .select({
        id: dossierFiles.id,
        dossierId: dossierFiles.dossierId,
        securityLevelId: dossierFiles.securityLevelId,
        accessPasswordEnabled: dossierFiles.accessPasswordEnabled,
        accessPasswordHash: dossierFiles.accessPasswordHash,
        passwordVersion: dossierFiles.passwordVersion,
        fileName: dossierFiles.fileName,
        filePath: dossierFiles.filePath,
      })
      .from(dossierFiles)
      .where(inArray(dossierFiles.id, missing))

    for (const row of rows) {
      this.files.set(row.id, {
        id: row.id,
        dossierId: row.dossierId,
        securityLevelId: row.securityLevelId,
        accessPasswordEnabled: row.accessPasswordEnabled,
        accessPasswordHash: row.accessPasswordHash ?? null,
        passwordVersion: row.passwordVersion ?? 1,
        fileName: row.fileName,
        filePath: row.filePath,
      })
    }
  }

  seedFile(info: FileGateInfo): void {
    this.files.set(info.id, info)
  }

  getFile(fileId: string): FileGateInfo | undefined {
    return this.files.get(fileId)
  }

  async resolveDossierPasswordSource(dossier: {
    accessPasswordEnabled: boolean
    accessPasswordHash: string | null | undefined
    securityLevelId: string | null | undefined
  }): Promise<PasswordSource> {
    if (dossier.accessPasswordEnabled && dossier.accessPasswordHash) return "own"
    const levelId = dossier.securityLevelId ?? (await this.getLowestLevelId())
    if (!levelId) return "none"
    const requirePassword = await this.getEffectiveBool(
      levelId,
      PermissionRuleKey.requireAccessPassword,
    )
    if (!requirePassword) return "none"
    await this.loadLevelCredentials([levelId])
    const level = this.getLevelCredential(levelId)
    return level?.passwordHash ? "security_level" : "none"
  }

  async resolveFilePasswordSource(input: {
    accessPasswordEnabled: boolean
    accessPasswordHash: string | null | undefined
    securityLevelId: string | null | undefined
    dossierSecurityLevelId?: string | null
  }): Promise<PasswordSource> {
    if (input.accessPasswordEnabled && input.accessPasswordHash) return "own"
    const levelId =
      input.securityLevelId ??
      input.dossierSecurityLevelId ??
      (await this.getLowestLevelId())
    if (!levelId) return "none"
    const requireFilePassword = await this.getEffectiveBool(
      levelId,
      PermissionRuleKey.requireFilePassword,
    )
    if (!requireFilePassword) return "none"
    await this.loadLevelCredentials([levelId])
    const level = this.getLevelCredential(levelId)
    return level?.filePasswordHash ? "security_level" : "none"
  }

  async fileRequiresPasswordGate(input: {
    fileId: string
    levelId: string
  }): Promise<{ required: boolean; passwordVersion: number }> {
    let file = this.getFile(input.fileId)
    if (!file) {
      await this.loadFiles([input.fileId])
      file = this.getFile(input.fileId)
    }

    if (file?.accessPasswordEnabled && file.accessPasswordHash) {
      return { required: true, passwordVersion: file.passwordVersion }
    }

    const requireFilePassword = await this.getEffectiveBool(
      input.levelId,
      PermissionRuleKey.requireFilePassword,
    )
    if (!requireFilePassword) {
      return { required: false, passwordVersion: file?.passwordVersion ?? 1 }
    }

    await this.loadLevelCredentials([input.levelId])
    const level = this.getLevelCredential(input.levelId)
    if (!level?.filePasswordHash) {
      throw httpError.forbidden(
        `PASSWORD_REQUIRED:file:${input.fileId}:misconfigured`,
      )
    }
    return { required: true, passwordVersion: file?.passwordVersion ?? 1 }
  }

  async assertPermissionAllowed(
    resourceSecurityLevelId: string | null | undefined,
    permissionDefKey: string,
  ): Promise<string> {
    const levelId = resourceSecurityLevelId ?? (await this.getLowestLevelId())
    if (!levelId) {
      throw httpError.forbidden("Chưa cấu hình cấp độ bảo mật.")
    }
    const blocked = await this.getEffectiveBool(
      levelId,
      FlagRuleKey.blockExportDownload,
    )
    if (
      blocked &&
      (permissionDefKey === "download_original" ||
        permissionDefKey === "download_watermark" ||
        permissionDefKey === "export")
    ) {
      throw httpError.forbidden("Cấp độ này cấm xuất/tải hoàn toàn.")
    }
    const allowed = await this.getEffectiveBool(
      levelId,
      permissionRuleKey(permissionDefKey),
    )
    if (!allowed) {
      const defName = SYSTEM_PERMISSION_DEFS.find((d) => d.key === permissionDefKey)?.name ?? permissionDefKey
      throw httpError.forbidden(
        `Không có quyền ${defName} ở cấp độ bảo mật này.`,
      )
    }
    return levelId
  }
}

async function hasValidScopedToken(input: {
  tokens: string[]
  userId: string
  scope: "level" | "dossier" | "file"
  resourceId: string
  passwordVersion: number
}): Promise<boolean> {
  for (const token of input.tokens) {
    if (
      await verifySecurityAccessToken({
        token,
        userId: input.userId,
        scope: input.scope,
        resourceId: input.resourceId,
        passwordVersion: input.passwordVersion,
      })
    ) {
      return true
    }
  }
  return false
}

/** Password gates dùng cache — không query lặp theo từng file. */
export async function assertPasswordGatesCached(
  cache: SecurityRequestCache,
  input: {
    userId: string
    resourceSecurityLevelId: string | null | undefined
    dossierId?: string | null
    fileId?: string | null
    levelToken?: string
    levelTokens?: string[]
    dossierToken?: string
    dossierTokens?: string[]
    fileTokens?: string[]
  },
): Promise<void> {
  const levelId =
    input.resourceSecurityLevelId ?? (await cache.getLowestLevelId())
  if (!levelId) return

  const candidateLevelTokens = [
    ...(input.levelTokens ?? []),
    ...(input.levelToken ? [input.levelToken] : []),
  ].filter((token, index, tokens) => Boolean(token) && tokens.indexOf(token) === index)

  const candidateFileTokens = (input.fileTokens ?? []).filter(
    (token, index, tokens) => Boolean(token) && tokens.indexOf(token) === index,
  )
  const candidateDossierTokens = [
    ...(input.dossierTokens ?? []),
    ...(input.dossierToken ? [input.dossierToken] : []),
  ].filter((token, index, tokens) => Boolean(token) && tokens.indexOf(token) === index)

  let dossierPasswordVersion = 1
  let dossierInfo: DossierGateInfo | undefined

  if (input.dossierId) {
    dossierInfo = cache.getDossier(input.dossierId)
    if (!dossierInfo) {
      await cache.loadDossiers([input.dossierId])
      dossierInfo = cache.getDossier(input.dossierId)
    }
    dossierPasswordVersion = dossierInfo?.passwordVersion ?? 1

    if (dossierInfo?.accessPasswordEnabled && !dossierInfo.accessPasswordHash) {
      throw httpError.forbidden(
        `PASSWORD_REQUIRED:dossier:${input.dossierId}:misconfigured`,
      )
    }

    if (dossierInfo?.accessPasswordEnabled && dossierInfo.accessPasswordHash) {
      const ok = await hasValidScopedToken({
        tokens: candidateDossierTokens,
        userId: input.userId,
        scope: "dossier",
        resourceId: input.dossierId,
        passwordVersion: dossierPasswordVersion,
      })
      if (!ok) {
        throw httpError.forbidden(
          `PASSWORD_REQUIRED:dossier:${input.dossierId}`,
        )
      }
    }
  }

  let fileGate: { required: boolean; passwordVersion: number } | null = null
  if (input.fileId) {
    fileGate = await cache.fileRequiresPasswordGate({
      fileId: input.fileId,
      levelId,
    })
    if (fileGate.required) {
      const ok = await hasValidScopedToken({
        tokens: candidateFileTokens,
        userId: input.userId,
        scope: "file",
        resourceId: input.fileId,
        passwordVersion: fileGate.passwordVersion,
      })
      if (!ok) {
        throw httpError.forbidden(
          `PASSWORD_REQUIRED:file:${input.fileId}:${levelId}`,
        )
      }
    }
  }

  const requirePassword = await cache.getEffectiveBool(
    levelId,
    PermissionRuleKey.requireAccessPassword,
  )
  if (!requirePassword) return

  await cache.loadLevelCredentials([levelId])
  const level = cache.getLevelCredential(levelId)

  if (!level?.passwordHash) {
    if (input.dossierId) {
      throw httpError.forbidden(
        `PASSWORD_REQUIRED:dossier:${input.dossierId}:misconfigured`,
      )
    }
    throw httpError.forbidden(`PASSWORD_REQUIRED:level:${levelId}:misconfigured`)
  }

  const hasOwnDossierPassword = Boolean(
    dossierInfo?.accessPasswordEnabled && dossierInfo.accessPasswordHash,
  )
  if (hasOwnDossierPassword) return

  if (input.dossierId && !input.fileId) {
    const ok = await hasValidScopedToken({
      tokens: candidateDossierTokens,
      userId: input.userId,
      scope: "dossier",
      resourceId: input.dossierId,
      passwordVersion: dossierPasswordVersion,
    })
    if (!ok) {
      throw httpError.forbidden(
        `PASSWORD_REQUIRED:dossier:${input.dossierId}`,
      )
    }
    return
  }

  if (input.fileId) {
    if (!(fileGate?.required)) {
      const ok = await hasValidScopedToken({
        tokens: candidateLevelTokens,
        userId: input.userId,
        scope: "level",
        resourceId: levelId,
        passwordVersion: level.passwordVersion,
      })
      if (!ok) {
        throw httpError.forbidden(`PASSWORD_REQUIRED:level:${levelId}`)
      }
    }
    return
  }

  const ok = await hasValidScopedToken({
    tokens: candidateLevelTokens,
    userId: input.userId,
    scope: "level",
    resourceId: levelId,
    passwordVersion: level.passwordVersion,
  })
  if (!ok) {
    throw httpError.forbidden(`PASSWORD_REQUIRED:level:${levelId}`)
  }
}

export async function assertSecurityResourceAccessCached(
  cache: SecurityRequestCache,
  input: {
    userId: string
    resourceSecurityLevelId: string | null | undefined
    permissionDefKey: "view" | "download_original" | "download_watermark" | "export"
    dossierId?: string | null
    fileId?: string | null
    levelToken?: string
    levelTokens?: string[]
    dossierToken?: string
    dossierTokens?: string[]
    fileTokens?: string[]
  },
): Promise<void> {
  await cache.assertPermissionAllowed(
    input.resourceSecurityLevelId,
    input.permissionDefKey,
  )
  await assertPasswordGatesCached(cache, input)
}
