import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { securityLevels } from "../../db/schemas/security-level.ts";
import { securityLevelRules } from "../../db/schemas/security-level-rule.ts";
import { securityPermissionDefs } from "../../db/schemas/security-permission-def.ts";
import {
  FlagRuleKey,
  PermissionRuleKey,
  SYSTEM_DEFAULT_RULE_VALUES,
  permissionRuleKey,
  type ExportActorsValue,
  type ExportFormatsValue,
} from "./security-rule-keys.ts";

export type ResolvedRule = {
  ruleKey: string;
  effectiveValue: unknown;
  isOverridden: boolean;
  inheritedFromLevelId: string | null;
  inheritedFromLevelName: string | null;
  isLowestLevel: boolean;
};

function isLooserPermission(prev: unknown, next: unknown): boolean {
  return prev === false && next === true;
}

function isLooserFlag(ruleKey: string, prev: unknown, next: unknown): boolean {
  if (ruleKey === FlagRuleKey.blockExportDownload) {
    return prev === true && next === false;
  }
  if (
    ruleKey === FlagRuleKey.requirePassword ||
    ruleKey === FlagRuleKey.requireWatermark ||
    ruleKey === FlagRuleKey.requireEncryption
  ) {
    return prev === true && next === false;
  }
  if (ruleKey === FlagRuleKey.limitExportActors) {
    const p = prev as ExportActorsValue;
    const n = next as ExportActorsValue;
    return Boolean(p?.enabled) && !n?.enabled;
  }
  if (ruleKey === FlagRuleKey.limitExportFormats) {
    const p = prev as ExportFormatsValue;
    const n = next as ExportFormatsValue;
    return Boolean(p?.enabled) && !n?.enabled;
  }
  return false;
}

export function isLooserThanLower(
  ruleKey: string,
  lowerEffective: unknown,
  newValue: unknown,
): boolean {
  if (ruleKey.startsWith("permission.")) {
    return isLooserPermission(lowerEffective, newValue);
  }
  return isLooserFlag(ruleKey, lowerEffective, newValue);
}

export async function listActiveLevelsOrdered() {
  return db
    .select({
      id: securityLevels.id,
      name: securityLevels.name,
      levelOrder: securityLevels.levelOrder,
      passwordHash: securityLevels.passwordHash,
    })
    .from(securityLevels)
    .where(
      and(eq(securityLevels.isActive, true), isNull(securityLevels.deletedAt)),
    )
    .orderBy(asc(securityLevels.levelOrder));
}

/** Chỉ lấy quyền từ DB security_permission_defs (active). Không gồm flag.* hard-code. */
export async function listAllRuleKeys(): Promise<string[]> {
  const defs = await db
    .select({ key: securityPermissionDefs.key })
    .from(securityPermissionDefs)
    .where(
      and(
        eq(securityPermissionDefs.isActive, true),
        isNull(securityPermissionDefs.deletedAt),
      ),
    );
  return defs.map((d) => permissionRuleKey(d.key));
}

export async function getLowestActiveLevel() {
  const [row] = await db
    .select()
    .from(securityLevels)
    .where(
      and(eq(securityLevels.isActive, true), isNull(securityLevels.deletedAt)),
    )
    .orderBy(asc(securityLevels.levelOrder))
    .limit(1);
  return row ?? null;
}

export async function resolveLevelOrder(
  securityLevelId: string | null | undefined,
): Promise<number> {
  if (!securityLevelId) {
    const lowest = await getLowestActiveLevel();
    return lowest?.levelOrder ?? 0;
  }
  const [row] = await db
    .select({ levelOrder: securityLevels.levelOrder })
    .from(securityLevels)
    .where(
      and(
        eq(securityLevels.id, securityLevelId),
        isNull(securityLevels.deletedAt),
      ),
    )
    .limit(1);
  if (!row) {
    const lowest = await getLowestActiveLevel();
    return lowest?.levelOrder ?? 0;
  }
  return row.levelOrder;
}

/**
 * Live resolve: thiếu row hoặc isOverridden=false → kế thừa cấp liền dưới.
 * Cấp thấp nhất / thiếu dưới → SYSTEM_DEFAULT.
 */
export async function resolveEffectiveRules(
  securityLevelId: string,
): Promise<ResolvedRule[]> {
  const levels = await listActiveLevelsOrdered();
  const targetIdx = levels.findIndex((l) => l.id === securityLevelId);
  if (targetIdx < 0) {
    throw httpError.notFound(
      "Cấp độ bảo mật không tồn tại hoặc không hoạt động.",
    );
  }

  const isLowest = targetIdx === 0;
  const ruleKeys = await listAllRuleKeys();
  const levelIds = levels.slice(0, targetIdx + 1).map((l) => l.id);
  const rows =
    levelIds.length > 0
      ? await db
          .select()
          .from(securityLevelRules)
          .where(inArray(securityLevelRules.securityLevelId, levelIds))
      : [];

  const byLevel = new Map<string, Map<string, (typeof rows)[number]>>();
  for (const row of rows) {
    let map = byLevel.get(row.securityLevelId);
    if (!map) {
      map = new Map();
      byLevel.set(row.securityLevelId, map);
    }
    map.set(row.ruleKey, row);
  }

  return ruleKeys.map((ruleKey) => {
    for (let i = targetIdx; i >= 0; i--) {
      const level = levels[i]!;
      const row = byLevel.get(level.id)?.get(ruleKey);
      const atTarget = i === targetIdx;

      if (i === 0) {
        const value = row
          ? row.value
          : (SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false);
        return {
          ruleKey,
          effectiveValue: value,
          isOverridden: atTarget,
          inheritedFromLevelId: atTarget ? null : level.id,
          inheritedFromLevelName: atTarget ? null : level.name,
          isLowestLevel: isLowest,
        };
      }

      if (row?.isOverridden) {
        return {
          ruleKey,
          effectiveValue: row.value,
          isOverridden: atTarget,
          inheritedFromLevelId: atTarget ? null : level.id,
          inheritedFromLevelName: atTarget ? null : level.name,
          isLowestLevel: isLowest,
        };
      }
      // missing or not overridden → walk down
    }

    return {
      ruleKey,
      effectiveValue: SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false,
      isOverridden: false,
      inheritedFromLevelId: null,
      inheritedFromLevelName: null,
      isLowestLevel: isLowest,
    };
  });
}

/** Insert rules for a level. Higher new levels use isOverridden=false (inheriting). */
export async function insertSnapshotRules(
  securityLevelId: string,
  snapshot: Record<string, unknown>,
  options?: { isOverridden?: boolean },
) {
  const ruleKeys = Object.keys(snapshot);
  if (ruleKeys.length === 0) return;

  const isOverridden = options?.isOverridden ?? true;

  const existing = await db
    .select({ ruleKey: securityLevelRules.ruleKey })
    .from(securityLevelRules)
    .where(eq(securityLevelRules.securityLevelId, securityLevelId));
  const existingKeys = new Set(existing.map((r) => r.ruleKey));

  const toInsert = ruleKeys
    .filter((k) => !existingKeys.has(k))
    .map((ruleKey) => ({
      securityLevelId,
      ruleKey,
      isOverridden,
      value: snapshot[ruleKey] ?? false,
    }));

  if (toInsert.length > 0) {
    await db.insert(securityLevelRules).values(toInsert);
  }
}

export async function buildSnapshotFromLevel(
  securityLevelId: string,
): Promise<Record<string, unknown>> {
  const rules = await resolveEffectiveRules(securityLevelId);
  const snapshot: Record<string, unknown> = {};
  for (const r of rules) {
    snapshot[r.ruleKey] = r.effectiveValue;
  }
  return snapshot;
}

export async function buildDefaultSnapshot(): Promise<Record<string, unknown>> {
  const ruleKeys = await listAllRuleKeys();
  const snapshot: Record<string, unknown> = {};
  for (const ruleKey of ruleKeys) {
    snapshot[ruleKey] = SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false;
  }
  return snapshot;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

let didSoftMigrateInherited = false;

/**
 * Fill missing rule rows (low → high). Missing on higher levels inherit (isOverridden=false).
 * Does not force existing inherited rows to overridden.
 */
export async function materializeAllLevelSnapshots() {
  const levels = await listActiveLevelsOrdered();
  const ruleKeys = await listAllRuleKeys();
  if (levels.length === 0 || ruleKeys.length === 0) return;

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]!;
    const existing = await db
      .select()
      .from(securityLevelRules)
      .where(eq(securityLevelRules.securityLevelId, level.id));
    const byKey = new Map(existing.map((r) => [r.ruleKey, r]));

    const fillFrom =
      i === 0
        ? await buildDefaultSnapshot()
        : await buildSnapshotFromLevel(levels[i - 1]!.id);

    const missing = ruleKeys.filter((k) => !byKey.has(k));
    if (missing.length > 0) {
      await db.insert(securityLevelRules).values(
        missing.map((ruleKey) => ({
          securityLevelId: level.id,
          ruleKey,
          isOverridden: i === 0,
          value:
            fillFrom[ruleKey] ?? SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false,
        })),
      );
    }
  }

  await migrateMatchingRulesToInherited();
  didSoftMigrateInherited = true;
}

/**
 * Ensure rows exist for one level (and lower). Missing higher-level keys inherit.
 * Soft-migrates identical overridden copies once per process (legacy snapshot data).
 */
export async function ensureLevelSnapshotComplete(securityLevelId: string) {
  const levels = await listActiveLevelsOrdered();
  const idx = levels.findIndex((l) => l.id === securityLevelId);
  if (idx < 0) return;

  const ruleKeys = await listAllRuleKeys();

  for (let i = 0; i <= idx; i++) {
    const level = levels[i]!;
    const existing = await db
      .select()
      .from(securityLevelRules)
      .where(eq(securityLevelRules.securityLevelId, level.id));
    const byKey = new Map(existing.map((r) => [r.ruleKey, r]));
    const missing = ruleKeys.filter((k) => !byKey.has(k));

    if (missing.length > 0) {
      const fillFrom =
        i === 0
          ? await buildDefaultSnapshot()
          : await buildSnapshotFromLevel(levels[i - 1]!.id);
      await db.insert(securityLevelRules).values(
        missing.map((ruleKey) => ({
          securityLevelId: level.id,
          ruleKey,
          isOverridden: i === 0,
          value:
            fillFrom[ruleKey] ?? SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false,
        })),
      );
    }
  }

  if (!didSoftMigrateInherited) {
    await migrateMatchingRulesToInherited();
    didSoftMigrateInherited = true;
  }
}

/**
 * Soft migrate: non-lowest rules whose value equals adjacent lower effective
 * become isOverridden=false so live inherit works on legacy snapshot data.
 */
export async function migrateMatchingRulesToInherited() {
  const levels = await listActiveLevelsOrdered();
  if (levels.length < 2) return;

  for (let i = 1; i < levels.length; i++) {
    const level = levels[i]!;
    const lower = levels[i - 1]!;
    const lowerEffective = await resolveEffectiveRules(lower.id);
    const lowerByKey = new Map(
      lowerEffective.map((r) => [r.ruleKey, r.effectiveValue]),
    );

    const rows = await db
      .select()
      .from(securityLevelRules)
      .where(
        and(
          eq(securityLevelRules.securityLevelId, level.id),
          eq(securityLevelRules.isOverridden, true),
        ),
      );

    for (const row of rows) {
      const lowerValue = lowerByKey.get(row.ruleKey);
      if (lowerValue === undefined) continue;
      if (!valuesEqual(row.value, lowerValue)) continue;

      await db
        .update(securityLevelRules)
        .set({ isOverridden: false, updatedAt: new Date() })
        .where(eq(securityLevelRules.id, row.id));
    }
  }
}

export async function getEffectiveBool(
  securityLevelId: string,
  ruleKey: string,
): Promise<boolean> {
  const rules = await resolveEffectiveRules(securityLevelId);
  const hit = rules.find((r) => r.ruleKey === ruleKey);
  return Boolean(hit?.effectiveValue);
}

export async function getEffectiveValue<T = unknown>(
  securityLevelId: string,
  ruleKey: string,
): Promise<T> {
  const rules = await resolveEffectiveRules(securityLevelId);
  const hit = rules.find((r) => r.ruleKey === ruleKey);
  return hit?.effectiveValue as T;
}

export async function assertActiveSecurityLevelId(
  securityLevelId: string | null | undefined,
): Promise<void> {
  if (securityLevelId == null) {
    return;
  }
  const [row] = await db
    .select({ id: securityLevels.id })
    .from(securityLevels)
    .where(
      and(
        eq(securityLevels.id, securityLevelId),
        eq(securityLevels.isActive, true),
        isNull(securityLevels.deletedAt),
      ),
    )
    .limit(1);
  if (!row) {
    throw httpError.badRequest(
      "Cấp độ bảo mật không hợp lệ hoặc không còn hoạt động.",
    );
  }
}

export async function assertPermissionAllowed(
  resourceSecurityLevelId: string | null | undefined,
  permissionDefKey: string,
) {
  const levelId = resourceSecurityLevelId ?? (await getLowestActiveLevel())?.id;
  if (!levelId) {
    throw httpError.forbidden("Chưa cấu hình cấp độ bảo mật.");
  }
  const blocked = await getEffectiveBool(
    levelId,
    FlagRuleKey.blockExportDownload,
  );
  if (
    blocked &&
    (permissionDefKey === "download_original" ||
      permissionDefKey === "download_watermark" ||
      permissionDefKey === "export")
  ) {
    throw httpError.forbidden("Cấp độ này cấm xuất/tải hoàn toàn.");
  }
  const allowed = await getEffectiveBool(
    levelId,
    permissionRuleKey(permissionDefKey),
  );
  if (!allowed) {
    throw httpError.forbidden(
      `Không có quyền "${permissionDefKey}" ở cấp độ bảo mật này.`,
    );
  }
  return levelId;
}

export { PermissionRuleKey, FlagRuleKey };
