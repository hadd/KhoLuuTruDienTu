import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { isNull, sql } from "drizzle-orm";
import { connectDb, closeDb } from "../../db/db-conn.ts";
import { securityLevels } from "../../db/schemas/security-level.ts";
import { logger } from "./utils.ts";

export const DEFAULT_SECURITY_LEVELS = [
    { name: "Công khai", levelOrder: 1, description: "Tài liệu công khai, không hạn chế truy cập" },
    { name: "Nội bộ", levelOrder: 2, description: "Tài liệu lưu hành nội bộ" },
    { name: "Hạn chế", levelOrder: 3, description: "Tài liệu hạn chế truy cập" },
    { name: "Tuyệt mật", levelOrder: 4, description: "Tài liệu tuyệt mật, kiểm soát chặt chẽ" },
] as const;

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
        logger.info("✅ security_levels: already seeded, skipping");
        return;
    }

    await db.insert(securityLevels).values(
        missing.map((level) => ({
            name: level.name,
            description: level.description,
            levelOrder: level.levelOrder,
            requireEncryption: false,
            requireWatermark: false,
            exportRoleIds: [],
            isActive: true,
        })),
    );

    logger.info(`✅ security_levels: inserted ${missing.length} rows`);
}

if (import.meta.main) {
    try {
        await seedSecurityLevels(connectDb());
        await closeDb();
        Deno.exit(0);
    } catch (error) {
        logger.error("❌ Seeding security levels failed:", error);
        await closeDb();
        Deno.exit(1);
    }
}
