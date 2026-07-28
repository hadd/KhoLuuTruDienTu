/**
 * Script một lần:
 * 1. Đảm bảo download_original + download_watermark đang is_active=true (hiện trong modal cấu hình cấp)
 * 2. Insert quyền mới encrypt_download nếu chưa có
 * 3. Backfill security_level_rules cho tất cả các cấp hiện có
 *
 * Run: deno run -A --env scripts/fix-encrypt-download-permission.ts
 */
import { and, eq, isNull } from "drizzle-orm";
import { connectDb, closeDb } from "../db/db-conn.ts";
import { securityLevels } from "../db/schemas/security-level.ts";
import { securityPermissionDefs } from "../db/schemas/security-permission-def.ts";
import { securityLevelRules } from "../db/schemas/security-level-rule.ts";
import { SYSTEM_DEFAULT_RULE_VALUES, permissionRuleKey } from "../modules/security-level/security-rule-keys.ts";

const ACTIVATE_KEYS = ["download_original", "download_watermark"];

const NEW_DEF = {
    key: "encrypt_download",
    name: "Mã hóa tài liệu",
    description: "Bắt buộc mã PIN cá nhân khi tải xuống (cả bản gốc lẫn watermark)",
    isSystem: true,
    isActive: true,
};

const db = connectDb();

try {
    // 1. Ensure download_original + download_watermark are active (gated by security level)
    for (const key of ACTIVATE_KEYS) {
        const result = await db
            .update(securityPermissionDefs)
            .set({ isActive: true, updatedAt: new Date() })
            .where(and(
                eq(securityPermissionDefs.key, key),
                isNull(securityPermissionDefs.deletedAt),
            ))
            .returning({ id: securityPermissionDefs.id });
        if (result.length > 0) {
            console.log(`✅ Activated: ${key}`);
        } else {
            console.log(`⚠️  Not found or already deleted: ${key}`);
        }
    }

    // 2. Insert encrypt_download nếu chưa có
    const [existing] = await db
        .select({ id: securityPermissionDefs.id })
        .from(securityPermissionDefs)
        .where(and(
            eq(securityPermissionDefs.key, NEW_DEF.key),
            isNull(securityPermissionDefs.deletedAt),
        ))
        .limit(1);

    let defId: string;
    if (existing) {
        await db
            .update(securityPermissionDefs)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(securityPermissionDefs.id, existing.id));
        defId = existing.id;
        console.log(`✅ encrypt_download already exists, ensured active`);
    } else {
        const [inserted] = await db
            .insert(securityPermissionDefs)
            .values(NEW_DEF)
            .returning({ id: securityPermissionDefs.id });
        defId = inserted!.id;
        console.log(`✅ Inserted: encrypt_download (id=${defId})`);
    }

    // 3. Backfill security_level_rules for encrypt_download on all active levels
    const ruleKey = permissionRuleKey(NEW_DEF.key);
    const defaultValue = SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false;

    const levels = await db
        .select({ id: securityLevels.id, name: securityLevels.name, levelOrder: securityLevels.levelOrder })
        .from(securityLevels)
        .where(and(
            eq(securityLevels.isActive, true),
            isNull(securityLevels.deletedAt),
        ));

    for (const level of levels) {
        const [ruleExists] = await db
            .select({ id: securityLevelRules.id })
            .from(securityLevelRules)
            .where(and(
                eq(securityLevelRules.securityLevelId, level.id),
                eq(securityLevelRules.ruleKey, ruleKey),
            ))
            .limit(1);

        if (ruleExists) {
            console.log(`⏭️  Rule already exists for level "${level.name}" (${level.levelOrder})`);
            continue;
        }

        const isLowest = levels.every((l) => l.levelOrder >= level.levelOrder);
        await db.insert(securityLevelRules).values({
            securityLevelId: level.id,
            ruleKey,
            isOverridden: isLowest,
            value: defaultValue,
        });
        console.log(`✅ Backfilled rule for level "${level.name}" (${level.levelOrder}), isOverridden=${isLowest}`);
    }

    console.log("Done.");
} finally {
    await closeDb();
}
