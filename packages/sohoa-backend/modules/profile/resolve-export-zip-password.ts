import { and, eq, inArray, isNull } from "drizzle-orm";
import { httpError, logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { securityLevels } from "../../db/schemas/security-level.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { decryptPassword } from "../../libs/email-crypto.ts";
import { verifyPassword } from "../../libs/helpers/password.ts";
import { getLowestActiveLevel } from "../security-level/security-clearance.ts";
import {
  resolveZipEncryptModeForDossiers,
  type ZipEncryptMode,
} from "../security-level/security-enforcement.ts";

export const ZIP_PIN_REQUIRED = "ZIP_PIN_REQUIRED";
export const ZIP_DOSSIER_PASSWORD_REQUIRED = "ZIP_DOSSIER_PASSWORD_REQUIRED";

export type ZipPasswordSource = "personal_pin" | "dossier" | "none";

export type ResolvedExportZipPassword = {
  password: string | undefined;
  source: ZipPasswordSource;
};

/**
 * Resolve ZIP password for export.
 * - personal_pin: user PIN (required; no dossier fallback)
 * - dossier_password: plaintext from client, verified against dossier/level hash
 * - none: no password
 */
export async function resolveExportZipPassword(input: {
  userId: string;
  dossierIds: string[];
  dossierAccessPassword?: string;
  mode?: ZipEncryptMode;
}): Promise<ResolvedExportZipPassword> {
  if (!input.userId?.trim() || input.dossierIds.length === 0) {
    return { password: undefined, source: "none" };
  }

  const mode = input.mode ??
    (await resolveZipEncryptModeForDossiers(input.dossierIds));

  if (mode === "none") {
    return { password: undefined, source: "none" };
  }

  if (mode === "personal_pin") {
    const pin = await tryDecryptUserDownloadPin(input.userId);
    if (!pin) {
      throw httpError.forbidden(
        `${ZIP_PIN_REQUIRED}: Cấp độ bảo mật yêu cầu mã hóa ZIP. Vui lòng đặt mã PIN cá nhân trước khi tải xuống.`,
      );
    }
    return { password: pin, source: "personal_pin" };
  }

  const password = await resolveVerifiedDossierAccessPassword(
    input.dossierIds,
    input.dossierAccessPassword,
  );
  return { password, source: "dossier" };
}

async function tryDecryptUserDownloadPin(
  userId: string,
): Promise<string | undefined> {
  if (!userId?.trim()) return undefined;

  const profile = await db.query.userProfiles.findFirst({
    where: and(eq(userProfiles.id, userId), isNull(userProfiles.deletedAt)),
    columns: {
      id: true,
      downloadPasswordEncrypted: true,
    },
  });

  if (!profile?.downloadPasswordEncrypted) return undefined;

  try {
    return await decryptPassword(profile.downloadPasswordEncrypted);
  } catch (err) {
    logApi.error(
      { err, userId: profile.id },
      "[export] Failed to decrypt user download ZIP password",
    );
    throw httpError.internal(
      "Không giải mã được mật khẩu tải xuống của người dùng",
    );
  }
}

/**
 * Verify one plaintext against every dossier in the batch (own hash, else level hash).
 */
async function resolveVerifiedDossierAccessPassword(
  dossierIds: string[],
  password: string | undefined,
): Promise<string> {
  const uniqueIds = [
    ...new Set(dossierIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) {
    throw httpError.badRequest("Không có hồ sơ để xuất.");
  }

  const plain = password?.trim() ?? "";
  if (!plain) {
    throw httpError.forbidden(
      `${ZIP_DOSSIER_PASSWORD_REQUIRED}: Cấp độ bảo mật yêu cầu mã hóa ZIP bằng mật khẩu hồ sơ. Vui lòng nhập mật khẩu hồ sơ.`,
    );
  }

  const rows = await db
    .select({
      id: dossiers.id,
      accessPasswordEnabled: dossiers.accessPasswordEnabled,
      accessPasswordHash: dossiers.accessPasswordHash,
      securityLevelId: dossiers.securityLevelId,
    })
    .from(dossiers)
    .where(and(inArray(dossiers.id, uniqueIds), isNull(dossiers.deletedAt)));

  if (rows.length !== uniqueIds.length) {
    throw httpError.notFound("Một hoặc nhiều hồ sơ không tồn tại.");
  }

  const lowest = await getLowestActiveLevel();
  const levelIds = [
    ...new Set(
      rows.map((r) => r.securityLevelId ?? lowest?.id).filter(Boolean),
    ),
  ] as string[];

  const levelHashById = new Map<string, string | null>();
  if (levelIds.length > 0) {
    const levels = await db
      .select({
        id: securityLevels.id,
        passwordHash: securityLevels.passwordHash,
      })
      .from(securityLevels)
      .where(inArray(securityLevels.id, levelIds));
    for (const level of levels) {
      levelHashById.set(level.id, level.passwordHash ?? null);
    }
  }

  for (const row of rows) {
    let hash: string | null = null;
    if (row.accessPasswordEnabled && row.accessPasswordHash) {
      hash = row.accessPasswordHash;
    } else {
      const levelId = row.securityLevelId ?? lowest?.id;
      hash = levelId ? (levelHashById.get(levelId) ?? null) : null;
    }

    if (!hash) {
      throw httpError.forbidden(
        `${ZIP_DOSSIER_PASSWORD_REQUIRED}: Hồ sơ chưa có mật khẩu truy cập để khóa ZIP. Vui lòng đặt mật khẩu hồ sơ hoặc mật khẩu chung theo cấp trước khi tải.`,
      );
    }

    const ok = await verifyPassword(plain, hash);
    if (!ok) {
      throw httpError.forbidden(
        `${ZIP_DOSSIER_PASSWORD_REQUIRED}: Mật khẩu hồ sơ không đúng.`,
      );
    }
  }

  return plain;
}

/** @deprecated Use resolveExportZipPassword */
export async function resolveUserDownloadZipPassword(
  userId: string,
  _applyWatermark: boolean,
  encryptDownload: boolean = false,
): Promise<string | undefined> {
  if (!encryptDownload) return undefined;
  const pin = await tryDecryptUserDownloadPin(userId);
  if (!pin) {
    throw httpError.forbidden(
      `${ZIP_PIN_REQUIRED}: Cấp độ bảo mật này yêu cầu mã hóa tài liệu. Vui lòng đặt mã PIN cá nhân trước khi tải xuống.`,
    );
  }
  return pin;
}
