/**
 * Script một lần:
 * 1. Insert quyền require_file_password nếu chưa có
 * 2. Backfill security_level_rules cho tất cả các cấp hiện có (default false)
 * 3. Cập nhật copy require_access_password → mật khẩu hồ sơ
 *
 * Run: deno run -A --env scripts/fix-require-file-password-permission.ts
 */
import { and, eq, isNull } from "drizzle-orm";
import { connectDb, closeDb } from "../db/db-conn.ts";
import { securityLevels } from "../db/schemas/security-level.ts";
import { securityPermissionDefs } from "../db/schemas/security-permission-def.ts";
import { securityLevelRules } from "../db/schemas/security-level-rule.ts";
import {
    SYSTEM_DEFAULT_RULE_VALUES,
    permissionRuleKey,
} from "../modules/security-level/security-rule-keys.ts";

const NEW_DEF = {
    key: "require_file_password",
    name: "Yêu cầu mật khẩu file",
    description: "Xem/tải từng file thuộc cấp này phải nhập mật khẩu file (token theo từng file)",
    isSystem: true,
    isActive: true,
};

const ACCESS_PASSWORD_COPY = {
    key: "require_access_password",
    name: "Yêu cầu mật khẩu hồ sơ",
    description: "Xem/tải hồ sơ thuộc cấp này phải nhập mật khẩu hồ sơ (token theo từng hồ sơ)",
};

const db = connectDb();

try {
    const [accessExisting] = await db
        .select({ id: securityPermissionDefs.id })
        .from(securityPermissionDefs)
        .where(and(
            eq(securityPermissionDefs.key, ACCESS_PASSWORD_COPY.key),
            isNull(securityPermissionDefs.deletedAt),
        ))
        .limit(1);
    if (accessExisting) {
        await db
            .update(securityPermissionDefs)
            .set({
                name: ACCESS_PASSWORD_COPY.name,
                description: ACCESS_PASSWORD_COPY.description,
                updatedAt: new Date(),
            })
            .where(eq(securityPermissionDefs.id, accessExisting.id));
        console.log(`✅ Updated copy for require_access_password`);
    }

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
            .set({
                name: NEW_DEF.name,
                description: NEW_DEF.description,
                isActive: true,
                isSystem: true,
                updatedAt: new Date(),
            })
            .where(eq(securityPermissionDefs.id, existing.id));
        defId = existing.id;
        console.log(`✅ require_file_password already exists, ensured active (id=${defId})`);
    } else {
        const [inserted] = await db
            .insert(securityPermissionDefs)
            .values(NEW_DEF)
            .returning({ id: securityPermissionDefs.id });
        defId = inserted!.id;
        console.log(`✅ Inserted: require_file_password (id=${defId})`);
    }

    const ruleKey = permissionRuleKey(NEW_DEF.key);
    const defaultValue = SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false;

    const levels = await db
        .select({
            id: securityLevels.id,
            name: securityLevels.name,
            levelOrder: securityLevels.levelOrder,
        })
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
        console.log(
            `✅ Backfilled rule for level "${level.name}" (${level.levelOrder}), isOverridden=${isLowest}`,
        );
    }

    console.log("Done.");
} finally {
    await closeDb();
}
