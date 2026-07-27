import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { connectDb, closeDb } from "../../db/db-conn.ts";
import { securityLevels } from "../../db/schemas/security-level.ts";
import { securityPermissionDefs } from "../../db/schemas/security-permission-def.ts";
import { securityLevelRules } from "../../db/schemas/security-level-rule.ts";
import {
    FLAG_RULE_KEYS,
    SYSTEM_DEFAULT_RULE_VALUES,
    SYSTEM_PERMISSION_DEFS,
    permissionRuleKey,
} from "../../modules/security-level/security-rule-keys.ts";
import { logger } from "./utils.ts";

export const DEFAULT_SECURITY_LEVELS = [
    { name: "Công khai", levelOrder: 1, description: "Tài liệu công khai, không hạn chế truy cập" },
    { name: "Nội bộ", levelOrder: 2, description: "Tài liệu lưu hành nội bộ" },
    { name: "Hạn chế", levelOrder: 3, description: "Tài liệu hạn chế truy cập" },
    { name: "Tuyệt mật", levelOrder: 4, description: "Tài liệu tuyệt mật, kiểm soát chặt chẽ" },
] as const;

export async function seedSecurityPermissionDefs(db: PostgresJsDatabase<any>) {
    logger.info("Seeding security_permission_defs...");
    const existing = await db
        .select({ key: securityPermissionDefs.key })
        .from(securityPermissionDefs)
        .where(isNull(securityPermissionDefs.deletedAt));
    const existingKeys = new Set(existing.map((r) => r.key));
    const missing = SYSTEM_PERMISSION_DEFS.filter((d) => !existingKeys.has(d.key));
    if (missing.length === 0) {
        logger.info("✅ security_permission_defs: already seeded");
        return;
    }
    await db.insert(securityPermissionDefs).values(
        missing.map((d) => ({
            key: d.key,
            name: d.name,
            description: d.description,
            isSystem: true,
            isActive: true,
        })),
    );
    logger.info(`✅ security_permission_defs: inserted ${missing.length}`);
}

export async function seedSecurityLevels(db: PostgresJsDatabase<any>) {
    logger.info("Seeding security_levels (default catalog)...");

    const existing = await db
        .select({ name: sql<string>`lower(${securityLevels.name})`, levelOrder: securityLevels.levelOrder })
        .from(securityLevels)
        .where(isNull(securityLevels.deletedAt));

    const existingNames = new Set(existing.map((row) => row.name));
    const existingOrders = new Set(existing.map((row) => row.levelOrder));

    const missing = DEFAULT_SECURITY_LEVELS.filter(
        (level) =>
            !existingNames.has(level.name.toLowerCase()) &&
            !existingOrders.has(level.levelOrder),
    );

    if (missing.length === 0) {
        logger.info("✅ security_levels: already seeded, skipping insert");
    } else {
        await db.insert(securityLevels).values(
            missing.map((level) => ({
                name: level.name,
                description: level.description,
                levelOrder: level.levelOrder,
                isActive: true,
            })),
        );
        logger.info(`✅ security_levels: inserted ${missing.length} rows`);
    }

    await seedLowestLevelRules(db);
}

async function seedLowestLevelRules(db: PostgresJsDatabase<any>) {
    const [lowest] = await db
        .select()
        .from(securityLevels)
        .where(and(eq(securityLevels.isActive, true), isNull(securityLevels.deletedAt)))
        .orderBy(asc(securityLevels.levelOrder))
        .limit(1);
    if (!lowest) return;

    const defs = await db
        .select({ key: securityPermissionDefs.key })
        .from(securityPermissionDefs)
        .where(and(eq(securityPermissionDefs.isActive, true), isNull(securityPermissionDefs.deletedAt)));

    const ruleKeys = [
        ...defs.map((d) => permissionRuleKey(d.key)),
        ...FLAG_RULE_KEYS,
    ];

    for (const ruleKey of ruleKeys) {
        const [exists] = await db
            .select({ id: securityLevelRules.id })
            .from(securityLevelRules)
            .where(and(
                eq(securityLevelRules.securityLevelId, lowest.id),
                eq(securityLevelRules.ruleKey, ruleKey),
            ))
            .limit(1);
        if (exists) continue;
        await db.insert(securityLevelRules).values({
            securityLevelId: lowest.id,
            ruleKey,
            isOverridden: true,
            value: SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false,
        });
    }
    logger.info("✅ security_level_rules: seeded defaults for lowest level");
}

if (import.meta.main) {
    try {
        const db = connectDb();
        await seedSecurityPermissionDefs(db);
        await seedSecurityLevels(db);
        await closeDb();
        Deno.exit(0);
    } catch (error) {
        logger.error("❌ Seeding security levels failed:", error);
        await closeDb();
        Deno.exit(1);
    }
}
