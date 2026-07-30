/**
 * Repair: apply 0036_archive_disposal.sql when migration is marked applied
 * but tables were never created (e.g. mark-pending-applied without SQL).
 */
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { env } from "../../env.ts";

const migrationsDir = fileURLToPath(new URL("../../db/drizzle", import.meta.url));
const sqlPath = join(migrationsDir, "0036_archive_disposal.sql");

const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });

try {
    const [exists] = await sql<{ exists: boolean }[]>`
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'sohoa_app'
              AND table_name = 'duplicate_detection_rules'
        ) AS exists
    `;

    if (exists?.exists) {
        console.log("✅ Archive disposal tables already exist — nothing to do");
        Deno.exit(0);
    }

    const raw = Deno.readTextFileSync(sqlPath);
    const statements = raw
        .split("--> statement-breakpoint")
        .map((part) => part.trim())
        .filter(Boolean);

    console.log(`Applying ${statements.length} statements from 0036_archive_disposal.sql...`);

    for (const [index, statement] of statements.entries()) {
        await sql.unsafe(statement);
        console.log(`  ✓ ${index + 1}/${statements.length}`);
    }

    console.log("✅ Archive disposal schema applied");
} catch (error) {
    console.error("❌ Failed to apply archive disposal schema", error);
    Deno.exit(1);
} finally {
    await sql.end({ timeout: 5 });
}
