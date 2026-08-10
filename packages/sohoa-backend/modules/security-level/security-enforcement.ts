import { and, inArray, isNull } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { assertPasswordGates } from "./security-access-token.ts";
import {
  assertPasswordGatesCached,
  assertSecurityResourceAccessCached,
  SecurityRequestCache,
} from "./security-gate-context.ts";
import { PermissionRuleKey } from "./security-rule-keys.ts";

export type SecurityAccessHeaders = {
  levelToken?: string;
  levelTokens?: string[];
  dossierToken?: string;
  dossierTokens?: string[];
  fileTokens?: string[];
};

export function securityAccessHeadersFromRequest(
  request: Request,
): SecurityAccessHeaders {
  const levelToken = request.headers.get("x-security-level-token") ?? undefined;
  const levelTokensHeader = request.headers.get("x-security-level-tokens");
  const levelTokens = [
    ...(levelToken ? [levelToken] : []),
    ...(levelTokensHeader
      ? levelTokensHeader
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : []),
  ].filter((token, index, items) => items.indexOf(token) === index);

  const fileTokensHeader = request.headers.get("x-file-access-tokens");
  const fileTokens = fileTokensHeader
    ? fileTokensHeader
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
  const dossierToken =
    request.headers.get("x-dossier-access-token") ?? undefined;
  const dossierTokensHeader = request.headers.get("x-dossier-access-tokens");
  const dossierTokens = [
    ...(dossierToken ? [dossierToken] : []),
    ...(dossierTokensHeader
      ? dossierTokensHeader
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : []),
  ].filter((token, index, items) => items.indexOf(token) === index);

  return {
    levelToken: levelToken ?? levelTokens[0],
    levelTokens: levelTokens.length > 0 ? levelTokens : undefined,
    dossierToken: dossierToken ?? dossierTokens[0],
    dossierTokens: dossierTokens.length > 0 ? dossierTokens : undefined,
    fileTokens: fileTokens.length > 0 ? fileTokens : undefined,
  };
}

export async function assertSecurityResourceAccess(input: {
  userId: string;
  resourceSecurityLevelId: string | null | undefined;
  permissionDefKey: "view" | "download" | "download_watermark" | "export";
  dossierId?: string | null;
  fileId?: string | null;
  levelToken?: string;
  levelTokens?: string[];
  dossierToken?: string;
  dossierTokens?: string[];
  fileTokens?: string[];
  cache?: SecurityRequestCache;
}): Promise<void> {
  if (input.cache) {
    await assertSecurityResourceAccessCached(input.cache, input);
    return;
  }

  const { assertPermissionAllowed } = await import("./security-clearance.ts");
  await assertPermissionAllowed(
    input.resourceSecurityLevelId,
    input.permissionDefKey,
  );
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
  });
}

async function loadDossierSecurityLevels(dossierIds: string[]) {
  const uniqueIds = [
    ...new Set(dossierIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) {
    throw httpError.badRequest("Cần ít nhất một hồ sơ.");
  }

  const rows = await db
    .select({
      id: dossiers.id,
      securityLevelId: dossiers.securityLevelId,
    })
    .from(dossiers)
    .where(and(inArray(dossiers.id, uniqueIds), isNull(dossiers.deletedAt)));

  if (rows.length !== uniqueIds.length) {
    throw httpError.notFound("Một hoặc nhiều hồ sơ không tồn tại.");
  }

  return rows;
}

/**
 * applyWatermark = true khi BẤT KỲ hồ sơ nào trong batch có permission.download_watermark = true.
 * Nguyên tắc "strict wins": cấp bảo mật cao nhất quyết định — nếu có 1 hồ sơ cần watermark
 * thì toàn bộ batch đều được đóng dấu watermark.
 * Client applyWatermark bị bỏ qua.
 */
export async function resolveApplyWatermarkForDossiers(
  dossierIds: string[],
): Promise<boolean> {
  const rows = await loadDossierSecurityLevels(dossierIds);
  const cache = new SecurityRequestCache();
  await cache.preloadRules(rows.map((r) => r.securityLevelId));
  return resolveWatermarkFromCachedRows(rows, cache);
}

/**
 * Internal: resolve watermark từ rows + cache đã load (memory only, không query DB thêm).
 * Dùng để tránh load lại rows trong assertDownloadAllowedForExport.
 */
async function resolveWatermarkFromCachedRows(
  rows: Array<{ id: string; securityLevelId: string | null }>,
  cache: SecurityRequestCache,
): Promise<boolean> {
  const lowestId = await cache.getLowestLevelId();
  for (const row of rows) {
    const levelId = row.securityLevelId ?? lowestId;
    if (!levelId) continue;
    const requiresWatermark = await cache.getEffectiveBool(
      levelId,
      PermissionRuleKey.downloadWatermark,
    );
    if (requiresWatermark) return true; // bất kỳ cấp nào yêu cầu watermark → áp cho cả batch
  }
  return false;
}

/** encrypt_download = true nếu bất kỳ hồ sơ nào thuộc cấp có mã hóa tài liệu. */
export async function resolveEncryptDownloadForDossiers(
  dossierIds: string[],
): Promise<boolean> {
  const mode = await resolveZipEncryptModeForDossiers(dossierIds);
  return mode === "personal_pin";
}

export type ZipEncryptMode = "personal_pin" | "dossier_password" | "none";

/**
 * Resolve ZIP encrypt mode for a dossier batch.
 * - Mixed personal_pin + dossier_password in one batch → bad request (export từng HS).
 * - Both flags true on the same level should be rejected at config save; if still present, prefer dossier_password.
 */
export async function resolveZipEncryptModeForDossiers(
  dossierIds: string[],
): Promise<ZipEncryptMode> {
  const rows = await loadDossierSecurityLevels(dossierIds);
  const cache = new SecurityRequestCache();
  const lowestId = await cache.getLowestLevelId();

  let sawPersonal = false;
  let sawDossier = false;

  for (const row of rows) {
    const levelId = row.securityLevelId ?? lowestId;
    if (!levelId) continue;
    const personal = await cache.getEffectiveBool(
      levelId,
      PermissionRuleKey.encryptDownload,
    );
    const dossier = await cache.getEffectiveBool(
      levelId,
      PermissionRuleKey.encryptDownloadDossier,
    );
    if (personal && dossier) {
      // Misconfigured level: prefer dossier password mode.
      sawDossier = true;
      continue;
    }
    if (personal) sawPersonal = true;
    if (dossier) sawDossier = true;
  }

  if (sawPersonal && sawDossier) {
    throw httpError.badRequest(
      "Không thể xuất chung các hồ sơ thuộc cấp mã hóa ZIP khác nhau (PIN cá nhân vs mật khẩu hồ sơ). Vui lòng tải từng hồ sơ.",
    );
  }
  if (sawDossier) return "dossier_password";
  if (sawPersonal) return "personal_pin";
  return "none";
}

/**
 * Kiểm tra tải/xuất theo cấp bảo mật của từng hồ sơ và từng file PDF.
 * Watermark → permission.download_watermark; ngược lại → download.
 *
 * Tối ưu: nhận `_preloadedRows` và `_preloadedCache` từ `assertDownloadAllowedForExport`
 * để tránh load lại dữ liệu đã có sẵn (giảm số DB round-trips).
 */
export async function assertDownloadAllowedForDossiers(input: {
  userId: string;
  dossierIds: string[];
  applyWatermark: boolean;
  levelToken?: string;
  levelTokens?: string[];
  dossierToken?: string;
  dossierTokens?: string[];
  fileTokens?: string[];
  /** Internal: rows đã load từ caller để tránh query lại. */
  _preloadedRows?: Array<{ id: string; securityLevelId: string | null }>;
  /** Internal: cache đã preloadRules từ caller. */
  _preloadedCache?: SecurityRequestCache;
}): Promise<Set<string>> {
  const skippedFileIds = new Set<string>();

  // Dùng preloaded data nếu có (từ assertDownloadAllowedForExport) → tránh DB round-trip thêm
  const rows =
    input._preloadedRows ?? (await loadDossierSecurityLevels(input.dossierIds));
  const cache = input._preloadedCache ?? new SecurityRequestCache();

  if (!input._preloadedRows) {
    // Chỉ load khi chưa được caller chuẩn bị sẵn
    await cache.loadDossiers(rows.map((row) => row.id));
    await cache.preloadRules(rows.map((row) => row.securityLevelId));
  }

  const lowestId = await cache.getLowestLevelId();

  for (const row of rows) {
    // Dùng cache (memory lookup) để biết trước cấp này có bắt watermark không.
    // Tránh pattern try/catch tốn 2 async calls tuần tự.
    let permKey: "download" | "download_watermark" = input.applyWatermark
      ? "download_watermark"
      : "download";

    if (input.applyWatermark) {
      const effectiveLevelId = row.securityLevelId ?? lowestId;
      const needsWatermark = effectiveLevelId
        ? await cache.getEffectiveBool(
            effectiveLevelId,
            PermissionRuleKey.downloadWatermark,
          )
        : false;
      if (!needsWatermark) {
        // Cấp này không bắt watermark nhưng batch cần watermark (strict wins).
        // Dùng "download" để check quyền; watermark vẫn được áp bởi caller.
        permKey = "download";
      }
    }

    await assertSecurityResourceAccess({
      userId: input.userId,
      resourceSecurityLevelId: row.securityLevelId,
      permissionDefKey: permKey,
      dossierId: row.id,
      levelToken: input.levelToken,
      levelTokens: input.levelTokens,
      dossierToken: input.dossierToken,
      dossierTokens: input.dossierTokens,
      fileTokens: input.fileTokens,
      cache,
    });
  }

  const files = await db
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
    .where(inArray(dossierFiles.dossierId, input.dossierIds));

  const pdfFiles = files.filter(
    (file) =>
      file.fileName.toLowerCase().endsWith(".pdf") ||
      file.filePath.toLowerCase().endsWith(".pdf"),
  );

  for (const file of pdfFiles) {
    cache.seedFile({
      id: file.id,
      dossierId: file.dossierId,
      securityLevelId: file.securityLevelId,
      accessPasswordEnabled: file.accessPasswordEnabled,
      accessPasswordHash: file.accessPasswordHash ?? null,
      passwordVersion: file.passwordVersion ?? 1,
      fileName: file.fileName,
      filePath: file.filePath,
    });
  }

  const dossierLevelById = new Map(
    rows.map((row) => [row.id, row.securityLevelId]),
  );
  await cache.preloadRules(
    pdfFiles.map(
      (file) =>
        file.securityLevelId ?? dossierLevelById.get(file.dossierId) ?? null,
    ),
  );
  await cache.loadLevelCredentials([
    ...rows.map((row) => row.securityLevelId),
    ...pdfFiles.map((file) => file.securityLevelId),
  ]);

  // permissionDefKey cho file-level assertions (cùng logic strict wins)
  const permissionDefKey = input.applyWatermark
    ? "download_watermark"
    : "download";

  for (const file of pdfFiles) {
    const effectiveLevelId =
      file.securityLevelId ?? dossierLevelById.get(file.dossierId) ?? null;

    try {
      await assertSecurityResourceAccess({
        userId: input.userId,
        resourceSecurityLevelId: effectiveLevelId,
        permissionDefKey,
        dossierId: file.dossierId,
        levelToken: input.levelToken,
        levelTokens: input.levelTokens,
        dossierToken: input.dossierToken,
        dossierTokens: input.dossierTokens,
        fileTokens: input.fileTokens,
        cache,
      });
    } catch (error) {
      if (
        permissionDefKey === "download_watermark" &&
        error instanceof Error &&
        error.message.startsWith("Không có quyền")
      ) {
        try {
          await assertSecurityResourceAccess({
            userId: input.userId,
            resourceSecurityLevelId: effectiveLevelId,
            permissionDefKey: "download",
            dossierId: file.dossierId,
            levelToken: input.levelToken,
            levelTokens: input.levelTokens,
            dossierToken: input.dossierToken,
            dossierTokens: input.dossierTokens,
            fileTokens: input.fileTokens,
            cache,
          });
        } catch (fallbackError) {
          if (
            fallbackError instanceof Error &&
            !fallbackError.message.startsWith("PASSWORD_REQUIRED")
          ) {
            skippedFileIds.add(file.id);
          } else {
            throw fallbackError;
          }
        }
      } else if (
        error instanceof Error &&
        !error.message.startsWith("PASSWORD_REQUIRED")
      ) {
        skippedFileIds.add(file.id);
      } else {
        throw error;
      }
    }
  }

  return skippedFileIds;
}

/**
 * Resolve watermark từ cấp bảo mật rồi assert quyền tương ứng.
 * Bỏ qua applyWatermark/placementId từ client.
 *
 * Tối ưu: load dossier security levels 1 lần duy nhất, chia sẻ cache
 * cho cả bước resolve watermark lẫn bước assert permission.
 */
export async function assertDownloadAllowedForExport(input: {
  userId: string;
  dossierIds: string[];
  levelToken?: string;
  levelTokens?: string[];
  dossierToken?: string;
  dossierTokens?: string[];
  fileTokens?: string[];
}): Promise<{ applyWatermark: boolean; skippedFileIds: Set<string> }> {
  // Load 1 lần duy nhất, chia sẻ cho cả watermark resolve và permission assert
  const rows = await loadDossierSecurityLevels(input.dossierIds);
  const cache = new SecurityRequestCache();
  await cache.loadDossiers(rows.map((r) => r.id));
  await cache.preloadRules(rows.map((r) => r.securityLevelId));

  // Resolve watermark từ cache đã có (memory only, không query DB thêm)
  const applyWatermark = await resolveWatermarkFromCachedRows(rows, cache);

  const skippedFileIds = await assertDownloadAllowedForDossiers({
    userId: input.userId,
    dossierIds: input.dossierIds,
    applyWatermark,
    levelToken: input.levelToken,
    levelTokens: input.levelTokens,
    dossierToken: input.dossierToken,
    dossierTokens: input.dossierTokens,
    fileTokens: input.fileTokens,
    _preloadedRows: rows, // tái dụng, không load lại
    _preloadedCache: cache, // tái dụng cache đã preload
  });
  return { applyWatermark, skippedFileIds };
}

export {
  SecurityRequestCache,
  assertPasswordGatesCached,
  assertSecurityResourceAccessCached,
};
