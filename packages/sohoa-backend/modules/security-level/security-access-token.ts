import { jwtVerify, SignJWT } from "jose"
import { and, eq, isNull } from "drizzle-orm"
import { httpError } from "@shared/common-lib"
import { db } from "../../db/db-conn.ts"
import { dossiers } from "../../db/schemas/dossier.ts"
import { dossierFiles } from "../../db/schemas/dossier-file.ts"
import { securityLevels } from "../../db/schemas/security-level.ts"
import { verifyPassword } from "../../libs/helpers/password.ts"
import { PermissionRuleKey } from "./security-rule-keys.ts"
import { getEffectiveBool, getLowestActiveLevel } from "./security-clearance.ts"

export const ACCESS_TTL_SEC = 15 * 60
export type PasswordSource = "own" | "security_level" | "none"

const secret = () =>
  new TextEncoder().encode(
    Deno.env.get("SECURITY_ACCESS_JWT_SECRET") ??
      Deno.env.get("JWT_SECRET") ??
      "sohoa-security-access-dev-secret",
  )

export type SecurityAccessScope = "level" | "dossier" | "file"

export async function issueSecurityAccessToken(input: {
  userId: string
  scope: SecurityAccessScope
  resourceId: string
  passwordVersion: number
}): Promise<{ token: string; expiresIn: number }> {
  const token = await new SignJWT({
    scope: input.scope,
    resourceId: input.resourceId,
    pwdv: input.passwordVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secret())
  return { token, expiresIn: ACCESS_TTL_SEC }
}

export async function verifySecurityAccessToken(input: {
  token: string | undefined
  userId: string
  scope: SecurityAccessScope
  resourceId: string
  passwordVersion: number
}): Promise<boolean> {
  if (!input.token) return false
  try {
    const { payload } = await jwtVerify(input.token, secret())
    const tokenVersion = typeof payload.pwdv === "number" ? payload.pwdv : 1
    return (
      payload.sub === input.userId &&
      payload.scope === input.scope &&
      payload.resourceId === input.resourceId &&
      tokenVersion === input.passwordVersion
    )
  } catch {
    return false
  }
}

export async function verifyLevelPassword(input: {
  userId: string
  securityLevelId: string
  password: string
}) {
  const [level] = await db
    .select()
    .from(securityLevels)
    .where(
      and(
        eq(securityLevels.id, input.securityLevelId),
        isNull(securityLevels.deletedAt),
      ),
    )
    .limit(1)
  if (!level) throw httpError.notFound("Cấp độ bảo mật không tồn tại.")
  if (!level.passwordHash) {
    throw httpError.badRequest("Cấp độ này chưa đặt mật khẩu hồ sơ.")
  }
  const ok = await verifyPassword(input.password, level.passwordHash)
  if (!ok) throw httpError.forbidden("Mật khẩu hồ sơ không đúng.")
  return issueSecurityAccessToken({
    userId: input.userId,
    scope: "level",
    resourceId: input.securityLevelId,
    passwordVersion: level.passwordVersion,
  })
}

/**
 * Verify mật khẩu vào hồ sơ → JWT scope dossier.
 * Ưu tiên hash riêng hồ sơ; fallback hash cấp khi require_access_password.
 */
export async function verifyDossierPassword(input: {
  userId: string
  dossierId: string
  password: string
}) {
  const [dossier] = await db
    .select()
    .from(dossiers)
    .where(and(eq(dossiers.id, input.dossierId), isNull(dossiers.deletedAt)))
    .limit(1)
  if (!dossier) throw httpError.notFound("Hồ sơ không tồn tại.")

  if (dossier.accessPasswordEnabled && dossier.accessPasswordHash) {
    const ok = await verifyPassword(input.password, dossier.accessPasswordHash)
    if (!ok) throw httpError.forbidden("Mật khẩu hồ sơ không đúng.")
    return issueSecurityAccessToken({
      userId: input.userId,
      scope: "dossier",
      resourceId: input.dossierId,
      passwordVersion: dossier.passwordVersion,
    })
  }

  const levelId = dossier.securityLevelId ?? (await getLowestActiveLevel())?.id
  if (!levelId) {
    throw httpError.badRequest("Hồ sơ này không yêu cầu mật khẩu.")
  }

  const requirePassword = await getEffectiveBool(
    levelId,
    PermissionRuleKey.requireAccessPassword,
  )
  const [level] = await db
    .select({
      passwordHash: securityLevels.passwordHash,
      passwordVersion: securityLevels.passwordVersion,
    })
    .from(securityLevels)
    .where(eq(securityLevels.id, levelId))
    .limit(1)

  if (requirePassword && !level?.passwordHash) {
    throw httpError.forbidden("PASSWORD_REQUIRED:dossier:misconfigured")
  }
  if (!requirePassword || !level?.passwordHash) {
    throw httpError.badRequest("Hồ sơ này không yêu cầu mật khẩu.")
  }

  const ok = await verifyPassword(input.password, level.passwordHash)
  if (!ok) throw httpError.forbidden("Mật khẩu hồ sơ không đúng.")
  return issueSecurityAccessToken({
    userId: input.userId,
    scope: "dossier",
    resourceId: input.dossierId,
    passwordVersion: dossier.passwordVersion,
  })
}

/**
 * Verify mật khẩu file → JWT scope file theo fileId.
 * Ưu tiên hash riêng file; fallback hash file theo cấp.
 * securityLevelId tùy chọn — nếu gửi phải khớp cấp hiệu lực.
 */
export async function verifyFilePassword(input: {
  userId: string
  securityLevelId?: string
  fileId: string
  password: string
}) {
  const [file] = await db
    .select({
      id: dossierFiles.id,
      dossierId: dossierFiles.dossierId,
      fileSecurityLevelId: dossierFiles.securityLevelId,
      accessPasswordEnabled: dossierFiles.accessPasswordEnabled,
      accessPasswordHash: dossierFiles.accessPasswordHash,
      passwordVersion: dossierFiles.passwordVersion,
      dossierSecurityLevelId: dossiers.securityLevelId,
    })
    .from(dossierFiles)
    .innerJoin(dossiers, eq(dossiers.id, dossierFiles.dossierId))
    .where(and(eq(dossierFiles.id, input.fileId), isNull(dossiers.deletedAt)))
    .limit(1)
  if (!file) throw httpError.notFound("File không tồn tại.")

  if (file.accessPasswordEnabled && file.accessPasswordHash) {
    const ok = await verifyPassword(input.password, file.accessPasswordHash)
    if (!ok) throw httpError.forbidden("Mật khẩu file không đúng.")
    return issueSecurityAccessToken({
      userId: input.userId,
      scope: "file",
      resourceId: input.fileId,
      passwordVersion: file.passwordVersion,
    })
  }

  const effectiveLevelId =
    file.fileSecurityLevelId ??
    file.dossierSecurityLevelId ??
    (await getLowestActiveLevel())?.id
  if (!effectiveLevelId) {
    throw httpError.badRequest("File này không yêu cầu mật khẩu.")
  }
  if (input.securityLevelId && input.securityLevelId !== effectiveLevelId) {
    throw httpError.badRequest("Cấp bảo mật không khớp với file.")
  }

  const requireFilePassword = await getEffectiveBool(
    effectiveLevelId,
    PermissionRuleKey.requireFilePassword,
  )
  const [level] = await db
    .select({
      filePasswordHash: securityLevels.filePasswordHash,
      filePasswordVersion: securityLevels.filePasswordVersion,
    })
    .from(securityLevels)
    .where(eq(securityLevels.id, effectiveLevelId))
    .limit(1)

  if (requireFilePassword && !level?.filePasswordHash) {
    throw httpError.forbidden(
      `PASSWORD_REQUIRED:file:${input.fileId}:misconfigured`,
    )
  }
  if (!requireFilePassword || !level?.filePasswordHash) {
    throw httpError.badRequest("File này không yêu cầu mật khẩu.")
  }

  const ok = await verifyPassword(input.password, level.filePasswordHash)
  if (!ok) throw httpError.forbidden("Mật khẩu file không đúng.")

  return issueSecurityAccessToken({
    userId: input.userId,
    scope: "file",
    resourceId: input.fileId,
    passwordVersion: file.passwordVersion,
  })
}

export async function resolveDossierPasswordSource(input: {
  accessPasswordEnabled: boolean
  accessPasswordHash: string | null | undefined
  securityLevelId: string | null | undefined
}): Promise<PasswordSource> {
  if (input.accessPasswordEnabled && input.accessPasswordHash) return "own"
  const levelId = input.securityLevelId ?? (await getLowestActiveLevel())?.id
  if (!levelId) return "none"
  const requirePassword = await getEffectiveBool(
    levelId,
    PermissionRuleKey.requireAccessPassword,
  )
  if (!requirePassword) return "none"
  const [level] = await db
    .select({ passwordHash: securityLevels.passwordHash })
    .from(securityLevels)
    .where(eq(securityLevels.id, levelId))
    .limit(1)
  return level?.passwordHash ? "security_level" : "none"
}

export async function resolveFilePasswordSource(input: {
  accessPasswordEnabled: boolean
  accessPasswordHash: string | null | undefined
  securityLevelId: string | null | undefined
  dossierSecurityLevelId?: string | null
}): Promise<PasswordSource> {
  if (input.accessPasswordEnabled && input.accessPasswordHash) return "own"
  const levelId =
    input.securityLevelId ??
    input.dossierSecurityLevelId ??
    (await getLowestActiveLevel())?.id
  if (!levelId) return "none"
  const requireFilePassword = await getEffectiveBool(
    levelId,
    PermissionRuleKey.requireFilePassword,
  )
  if (!requireFilePassword) return "none"
  const [level] = await db
    .select({ filePasswordHash: securityLevels.filePasswordHash })
    .from(securityLevels)
    .where(eq(securityLevels.id, levelId))
    .limit(1)
  return level?.filePasswordHash ? "security_level" : "none"
}

/** Throws 403 PASSWORD_REQUIRED when gates are not satisfied. */
export async function assertPasswordGates(input: {
  userId: string
  resourceSecurityLevelId: string | null | undefined
  dossierId?: string | null
  fileId?: string | null
  levelToken?: string
  levelTokens?: string[]
  dossierToken?: string
  dossierTokens?: string[]
  fileTokens?: string[]
  cache?: import("./security-gate-context.ts").SecurityRequestCache
}) {
  const { assertPasswordGatesCached, SecurityRequestCache } = await import(
    "./security-gate-context.ts"
  )
  await assertPasswordGatesCached(input.cache ?? new SecurityRequestCache(), input)
}
