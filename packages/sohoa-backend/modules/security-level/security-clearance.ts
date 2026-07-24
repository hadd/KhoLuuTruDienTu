import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { securityLevels } from "../../db/schemas/security-level.ts";
import { securityLevelRules } from "../../db/schemas/security-level-rule.ts";
import { securityPermissionDefs } from "../../db/schemas/security-permission-def.ts";
import {
    FLAG_RULE_KEYS,
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

export function isLooserThanLower(ruleKey: string, lowerEffective: unknown, newValue: unknown): boolean {
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
        .where(and(eq(securityLevels.isActive, true), isNull(securityLevels.deletedAt)))
        .orderBy(asc(securityLevels.levelOrder));
}

export async function listAllRuleKeys(): Promise<string[]> {
    const defs = await db
        .select({ key: securityPermissionDefs.key })
        .from(securityPermissionDefs)
        .where(and(eq(securityPermissionDefs.isActive, true), isNull(securityPermissionDefs.deletedAt)));
    return [...defs.map((d) => permissionRuleKey(d.key)), ...FLAG_RULE_KEYS];
}

export async function getLowestActiveLevel() {
    const [row] = await db
        .select()
        .from(securityLevels)
        .where(and(eq(securityLevels.isActive, true), isNull(securityLevels.deletedAt)))
        .orderBy(asc(securityLevels.levelOrder))
        .limit(1);
    return row ?? null;
}

export async function resolveLevelOrder(securityLevelId: string | null | undefined): Promise<number> {
    if (!securityLevelId) {
        const lowest = await getLowestActiveLevel();
        return lowest?.levelOrder ?? 0;
    }
    const [row] = await db
        .select({ levelOrder: securityLevels.levelOrder })
        .from(securityLevels)
        .where(and(eq(securityLevels.id, securityLevelId), isNull(securityLevels.deletedAt)))
        .limit(1);
    if (!row) {
        const lowest = await getLowestActiveLevel();
        return lowest?.levelOrder ?? 0;
    }
    return row.levelOrder;
}

export function canAccessByClearance(userLevelOrder: number, resourceLevelOrder: number): boolean {
    return userLevelOrder >= resourceLevelOrder;
}

/**
 * Snapshot-only resolve: mỗi cấp đọc rule của chính nó.
 * Thiếu row → SYSTEM_DEFAULT (không cascade live từ cấp thấp).
 */
export async function resolveEffectiveRules(securityLevelId: string): Promise<ResolvedRule[]> {
    const levels = await listActiveLevelsOrdered();
    const targetIdx = levels.findIndex((l) => l.id === securityLevelId);
    if (targetIdx < 0) {
        throw httpError.notFound("Cấp độ bảo mật không tồn tại hoặc không hoạt động.");
    }

    const isLowest = targetIdx === 0;
    const ruleKeys = await listAllRuleKeys();
    const rows = await db
        .select()
        .from(securityLevelRules)
        .where(eq(securityLevelRules.securityLevelId, securityLevelId));
    const byKey = new Map(rows.map((r) => [r.ruleKey, r]));

    return ruleKeys.map((ruleKey) => {
        const row = byKey.get(ruleKey);
        return {
            ruleKey,
            effectiveValue: row ? row.value : (SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false),
            isOverridden: true,
            inheritedFromLevelId: null,
            inheritedFromLevelName: null,
            isLowestLevel: isLowest,
        };
    });
}

/** Materialize snapshot rules for one level from a source map of ruleKey → value. */
export async function insertSnapshotRules(
    securityLevelId: string,
    snapshot: Record<string, unknown>,
) {
    const ruleKeys = Object.keys(snapshot);
    if (ruleKeys.length === 0) return;

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
            isOverridden: true,
            value: snapshot[ruleKey] ?? false,
        }));

    if (toInsert.length > 0) {
        await db.insert(securityLevelRules).values(toInsert);
    }
}

export async function buildSnapshotFromLevel(securityLevelId: string): Promise<Record<string, unknown>> {
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

/**
 * Materialize legacy/partial levels (low → high):
 * missing keys were live-inherit → copy from adjacent lower snapshot;
 * force is_overridden = true so resolve no longer cascades.
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

        const fillFrom = i === 0
            ? await buildDefaultSnapshot()
            : await buildSnapshotFromLevel(levels[i - 1]!.id);

        const missing = ruleKeys.filter((k) => !byKey.has(k));
        if (missing.length > 0) {
            await db.insert(securityLevelRules).values(
                missing.map((ruleKey) => ({
                    securityLevelId: level.id,
                    ruleKey,
                    isOverridden: true,
                    value: fillFrom[ruleKey] ?? SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false,
                })),
            );
        }

        if (existing.some((r) => !r.isOverridden)) {
            await db
                .update(securityLevelRules)
                .set({ isOverridden: true, updatedAt: new Date() })
                .where(and(
                    eq(securityLevelRules.securityLevelId, level.id),
                    eq(securityLevelRules.isOverridden, false),
                ));
        }
    }
}

/** Ensure one level has a full snapshot (fills missing from lower / defaults). */
export async function ensureLevelSnapshotComplete(securityLevelId: string) {
    const levels = await listActiveLevelsOrdered();
    const idx = levels.findIndex((l) => l.id === securityLevelId);
    if (idx < 0) return;

    // Materialize lower levels first so fill source is complete
    for (let i = 0; i <= idx; i++) {
        const level = levels[i]!;
        const ruleKeys = await listAllRuleKeys();
        const existing = await db
            .select()
            .from(securityLevelRules)
            .where(eq(securityLevelRules.securityLevelId, level.id));
        const byKey = new Map(existing.map((r) => [r.ruleKey, r]));
        const missing = ruleKeys.filter((k) => !byKey.has(k));

        if (missing.length > 0) {
            const fillFrom = i === 0
                ? await buildDefaultSnapshot()
                : await buildSnapshotFromLevel(levels[i - 1]!.id);
            await db.insert(securityLevelRules).values(
                missing.map((ruleKey) => ({
                    securityLevelId: level.id,
                    ruleKey,
                    isOverridden: true,
                    value: fillFrom[ruleKey] ?? SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false,
                })),
            );
        }

        if (existing.some((r) => !r.isOverridden)) {
            await db
                .update(securityLevelRules)
                .set({ isOverridden: true, updatedAt: new Date() })
                .where(and(
                    eq(securityLevelRules.securityLevelId, level.id),
                    eq(securityLevelRules.isOverridden, false),
                ));
        }
    }
}

export async function getEffectiveBool(securityLevelId: string, ruleKey: string): Promise<boolean> {
    const rules = await resolveEffectiveRules(securityLevelId);
    const hit = rules.find((r) => r.ruleKey === ruleKey);
    return Boolean(hit?.effectiveValue);
}

export async function getEffectiveValue<T = unknown>(securityLevelId: string, ruleKey: string): Promise<T> {
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
        .where(and(
            eq(securityLevels.id, securityLevelId),
            eq(securityLevels.isActive, true),
            isNull(securityLevels.deletedAt),
        ))
        .limit(1);
    if (!row) {
        throw httpError.badRequest("Cấp độ bảo mật không hợp lệ hoặc không còn hoạt động.");
    }
}

export async function assertClearance(
    userSecurityLevelId: string | null | undefined,
    resourceSecurityLevelId: string | null | undefined,
) {
    const userOrder = userSecurityLevelId
        ? await resolveLevelOrder(userSecurityLevelId)
        : 0;
    const resourceOrder = await resolveLevelOrder(resourceSecurityLevelId);
    if (!canAccessByClearance(userOrder, resourceOrder)) {
        throw httpError.forbidden("Bạn không đủ cấp độ bảo mật để truy cập nội dung này.");
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
    const blocked = await getEffectiveBool(levelId, FlagRuleKey.blockExportDownload);
    if (
        blocked &&
        (permissionDefKey === "download_original" ||
            permissionDefKey === "download_watermark" ||
            permissionDefKey === "export")
    ) {
        throw httpError.forbidden("Cấp độ này cấm xuất/tải hoàn toàn.");
    }
    const allowed = await getEffectiveBool(levelId, permissionRuleKey(permissionDefKey));
    if (!allowed) {
        throw httpError.forbidden(`Không có quyền "${permissionDefKey}" ở cấp độ bảo mật này.`);
    }
    return levelId;
}

export async function listAccessibleSecurityLevelIds(
    userSecurityLevelId: string | null | undefined,
): Promise<string[]> {
    const userOrder = userSecurityLevelId
        ? await resolveLevelOrder(userSecurityLevelId)
        : 0;
    const levels = await listActiveLevelsOrdered();
    return levels.filter((l) => l.levelOrder <= userOrder).map((l) => l.id);
}

export async function clearanceDossierCondition(
    userSecurityLevelId: string | null | undefined,
) {
    const accessibleIds = await listAccessibleSecurityLevelIds(userSecurityLevelId);
    if (accessibleIds.length === 0) {
        return sql`false`;
    }
    return or(
        isNull(dossiers.securityLevelId),
        inArray(dossiers.securityLevelId, accessibleIds),
    )!;
}

export { PermissionRuleKey, FlagRuleKey };
