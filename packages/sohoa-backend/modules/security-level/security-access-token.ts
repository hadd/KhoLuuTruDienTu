import { SignJWT, jwtVerify } from "jose";
import { and, eq, isNull } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { securityLevels } from "../../db/schemas/security-level.ts";
import { verifyPassword } from "../../libs/helpers/password.ts";
import { PermissionRuleKey } from "./security-rule-keys.ts";
import {
  getEffectiveBool,
  getLowestActiveLevel,
} from "./security-clearance.ts";

const ACCESS_TTL_SEC = 15 * 60;
const secret = () =>
  new TextEncoder().encode(
    Deno.env.get("SECURITY_ACCESS_JWT_SECRET") ??
      Deno.env.get("JWT_SECRET") ??
      "sohoa-security-access-dev-secret",
  );

export type SecurityAccessScope = "level" | "dossier";

export async function issueSecurityAccessToken(input: {
  userId: string;
  scope: SecurityAccessScope;
  resourceId: string;
}): Promise<{ token: string; expiresIn: number }> {
  const token = await new SignJWT({
    scope: input.scope,
    resourceId: input.resourceId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secret());
  return { token, expiresIn: ACCESS_TTL_SEC };
}

export async function verifySecurityAccessToken(input: {
  token: string | undefined;
  userId: string;
  scope: SecurityAccessScope;
  resourceId: string;
}): Promise<boolean> {
  if (!input.token) return false;
  try {
    const { payload } = await jwtVerify(input.token, secret());
    return (
      payload.sub === input.userId &&
      payload.scope === input.scope &&
      payload.resourceId === input.resourceId
    );
  } catch {
    return false;
  }
}

export async function verifyLevelPassword(input: {
  userId: string;
  securityLevelId: string;
  password: string;
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
    .limit(1);
  if (!level) throw httpError.notFound("Cấp độ bảo mật không tồn tại.");
  if (!level.passwordHash) {
    throw httpError.badRequest("Cấp độ này chưa đặt mật khẩu.");
  }
  const ok = await verifyPassword(input.password, level.passwordHash);
  if (!ok) throw httpError.unauthorized("Mật khẩu cấp độ không đúng.");
  return issueSecurityAccessToken({
    userId: input.userId,
    scope: "level",
    resourceId: input.securityLevelId,
  });
}

export async function verifyDossierPassword(input: {
  userId: string;
  dossierId: string;
  password: string;
}) {
  const [dossier] = await db
    .select()
    .from(dossiers)
    .where(and(eq(dossiers.id, input.dossierId), isNull(dossiers.deletedAt)))
    .limit(1);
  if (!dossier) throw httpError.notFound("Hồ sơ không tồn tại.");
  if (!dossier.accessPasswordEnabled || !dossier.accessPasswordHash) {
    throw httpError.badRequest("Hồ sơ này không yêu cầu mật khẩu riêng.");
  }
  const ok = await verifyPassword(input.password, dossier.accessPasswordHash);
  if (!ok) throw httpError.unauthorized("Mật khẩu hồ sơ không đúng.");
  return issueSecurityAccessToken({
    userId: input.userId,
    scope: "dossier",
    resourceId: input.dossierId,
  });
}

/** Throws 403 PASSWORD_REQUIRED when gates are not satisfied. */
export async function assertPasswordGates(input: {
  userId: string;
  resourceSecurityLevelId: string | null | undefined;
  dossierId?: string | null;
  levelToken?: string;
  levelTokens?: string[];
  dossierToken?: string;
}) {
  const levelId =
    input.resourceSecurityLevelId ?? (await getLowestActiveLevel())?.id;
  if (!levelId) return;

  const candidateLevelTokens = [
    ...(input.levelTokens ?? []),
    ...(input.levelToken ? [input.levelToken] : []),
  ].filter((token, index, tokens) => Boolean(token) && tokens.indexOf(token) === index);

  const requirePassword = await getEffectiveBool(
    levelId,
    PermissionRuleKey.requireAccessPassword,
  );
  if (requirePassword) {
    const [level] = await db
      .select({ passwordHash: securityLevels.passwordHash })
      .from(securityLevels)
      .where(eq(securityLevels.id, levelId))
      .limit(1);
    if (level?.passwordHash) {
      let ok = false;
      for (const token of candidateLevelTokens) {
        if (await verifySecurityAccessToken({
          token,
          userId: input.userId,
          scope: "level",
          resourceId: levelId,
        })) {
          ok = true;
          break;
        }
      }
      if (!ok) {
        throw httpError.forbidden(`PASSWORD_REQUIRED:level:${levelId}`);
      }
    }
  }

  if (input.dossierId) {
    const [dossier] = await db
      .select({
        accessPasswordEnabled: dossiers.accessPasswordEnabled,
        accessPasswordHash: dossiers.accessPasswordHash,
      })
      .from(dossiers)
      .where(eq(dossiers.id, input.dossierId))
      .limit(1);
    if (dossier?.accessPasswordEnabled && dossier.accessPasswordHash) {
      const ok = await verifySecurityAccessToken({
        token: input.dossierToken,
        userId: input.userId,
        scope: "dossier",
        resourceId: input.dossierId,
      });
      if (!ok) {
        throw httpError.forbidden("PASSWORD_REQUIRED:dossier");
      }
    }
  }
}
