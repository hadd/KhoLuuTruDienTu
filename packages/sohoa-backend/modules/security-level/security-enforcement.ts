import { and, inArray, isNull } from "drizzle-orm"
import { httpError } from "@shared/common-lib"
import { db } from "../../db/db-conn.ts"
import { dossiers } from "../../db/schemas/dossier.ts"
import { assertPermissionAllowed, getEffectiveBool, getLowestActiveLevel } from "./security-clearance.ts"
import { assertPasswordGates } from "./security-access-token.ts"
import { PermissionRuleKey } from "./security-rule-keys.ts"

export type SecurityAccessHeaders = {
  levelToken?: string
  levelTokens?: string[]
  dossierToken?: string
  dossierTokens?: string[]
  fileTokens?: string[]
}

export function securityAccessHeadersFromRequest(request: Request): SecurityAccessHeaders {
  const levelToken = request.headers.get("x-security-level-token") ?? undefined
  const levelTokensHeader = request.headers.get("x-security-level-tokens")
  const levelTokens = [
    ...(levelToken ? [levelToken] : []),
    ...(levelTokensHeader ? levelTokensHeader.split(",").map((part) => part.trim()).filter(Boolean) : []),
  ].filter((token, index, items) => items.indexOf(token) === index)

  const fileTokensHeader = request.headers.get("x-file-access-tokens")
  const fileTokens = fileTokensHeader ? fileTokensHeader.split(",").map((part) => part.trim()).filter(Boolean) : []
  const dossierToken = request.headers.get("x-dossier-access-token") ?? undefined
  const dossierTokensHeader = request.headers.get("x-dossier-access-tokens")
  const dossierTokens = [
    ...(dossierToken ? [dossierToken] : []),
    ...(dossierTokensHeader ? dossierTokensHeader.split(",").map((part) => part.trim()).filter(Boolean) : []),
  ].filter((token, index, items) => items.indexOf(token) === index)

  return {
    levelToken: levelToken ?? levelTokens[0],
    levelTokens: levelTokens.length > 0 ? levelTokens : undefined,
    dossierToken: dossierToken ?? dossierTokens[0],
    dossierTokens: dossierTokens.length > 0 ? dossierTokens : undefined,
    fileTokens: fileTokens.length > 0 ? fileTokens : undefined,
  }
}

export async function assertSecurityResourceAccess(input: {
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
}): Promise<void> {
  await assertPermissionAllowed(input.resourceSecurityLevelId, input.permissionDefKey)
  await assertPasswordGates({
    userId: input.userId,
    resourceSecurityLevelId: input.resourceSecurityLevelId,
    dossierId: input.dossierId ?? undefined,
    fileId: input.fileId ?? undefined,
    levelToken: input.levelToken,
    levelTokens: input.levelTokens,
    dossierToken: input.dossierToken,
    dossierTokens: input.dossierTokens,
    fileTokens: input.fileTokens,
  })
}

async function loadDossierSecurityLevels(dossierIds: string[]) {
  const uniqueIds = [...new Set(dossierIds.map((id) => id.trim()).filter(Boolean))]
  if (uniqueIds.length === 0) {
    throw httpError.badRequest("Cần ít nhất một hồ sơ.")
  }

  const rows = await db
    .select({
      id: dossiers.id,
      securityLevelId: dossiers.securityLevelId,
    })
    .from(dossiers)
    .where(and(
      inArray(dossiers.id, uniqueIds),
      isNull(dossiers.deletedAt),
    ))

  if (rows.length !== uniqueIds.length) {
    throw httpError.notFound("Một hoặc nhiều hồ sơ không tồn tại.")
  }

  return rows
}

/**
 * applyWatermark = true chỉ khi mọi hồ sơ có permission.download_watermark = true.
 * Client applyWatermark bị bỏ qua.
 */
export async function resolveApplyWatermarkForDossiers(dossierIds: string[]): Promise<boolean> {
  const rows = await loadDossierSecurityLevels(dossierIds)
  const lowestId = (await getLowestActiveLevel())?.id

  for (const row of rows) {
    const levelId = row.securityLevelId ?? lowestId
    if (!levelId) return false
    const allowed = await getEffectiveBool(levelId, PermissionRuleKey.downloadWatermark)
    if (!allowed) return false
  }
  return rows.length > 0
}

/** encrypt_download = true nếu bất kỳ hồ sơ nào thuộc cấp có mã hóa tài liệu. */
export async function resolveEncryptDownloadForDossiers(dossierIds: string[]): Promise<boolean> {
  const rows = await loadDossierSecurityLevels(dossierIds)
  const lowestId = (await getLowestActiveLevel())?.id

  for (const row of rows) {
    const levelId = row.securityLevelId ?? lowestId
    if (!levelId) continue
    if (await getEffectiveBool(levelId, PermissionRuleKey.encryptDownload)) {
      return true
    }
  }
  return false
}

/**
 * Kiểm tra tải/xuất theo cấp bảo mật của từng hồ sơ (không theo role download_*).
 * Watermark → permission.download_watermark; ngược lại → download_original.
 */
export async function assertDownloadAllowedForDossiers(input: {
  userId: string
  dossierIds: string[]
  applyWatermark: boolean
  levelToken?: string
  levelTokens?: string[]
  dossierToken?: string
  dossierTokens?: string[]
  fileTokens?: string[]
}): Promise<void> {
  const rows = await loadDossierSecurityLevels(input.dossierIds)

  const permissionDefKey = input.applyWatermark ? "download_watermark" : "download_original"

  for (const row of rows) {
    await assertSecurityResourceAccess({
      userId: input.userId,
      resourceSecurityLevelId: row.securityLevelId,
      permissionDefKey,
      dossierId: row.id,
      levelToken: input.levelToken,
      levelTokens: input.levelTokens,
      dossierToken: input.dossierToken,
      dossierTokens: input.dossierTokens,
      fileTokens: input.fileTokens,
    })
  }
}

/**
 * Resolve watermark từ cấp bảo mật rồi assert quyền tương ứng.
 * Bỏ qua applyWatermark/placementId từ client.
 */
export async function assertDownloadAllowedForExport(input: {
  userId: string
  dossierIds: string[]
  levelToken?: string
  levelTokens?: string[]
  dossierToken?: string
  dossierTokens?: string[]
  fileTokens?: string[]
}): Promise<{ applyWatermark: boolean }> {
  const applyWatermark = await resolveApplyWatermarkForDossiers(input.dossierIds)
  await assertDownloadAllowedForDossiers({
    userId: input.userId,
    dossierIds: input.dossierIds,
    applyWatermark,
    levelToken: input.levelToken,
    levelTokens: input.levelTokens,
    dossierToken: input.dossierToken,
    dossierTokens: input.dossierTokens,
    fileTokens: input.fileTokens,
  })
  return { applyWatermark }
}
