/**
 * Repair: apply 0050_council_evaluation_us.sql when drizzle migrator skipped pending SQL.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { env } from "../../env.ts";

const migrationsDir = fileURLToPath(new URL("../../db/drizzle", import.meta.url));
const tag = "0050_council_evaluation_us";
const sqlPath = join(migrationsDir, `${tag}.sql`);
const journalPath = join(migrationsDir, "meta", "_journal.json");

const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });

try {
    const [exists] = await sql<{ exists: boolean }[]>`
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'sohoa_app'
              AND table_name = 'disposal_review_council_item_outcomes'
        ) AS exists
    `;

    if (exists?.exists) {
        console.log("✅ disposal_review_council_item_outcomes already exists");
    } else {
        const raw = Deno.readTextFileSync(sqlPath);
        const statements = raw
            .split("--> statement-breakpoint")
            .map((part) => part.trim())
            .filter(Boolean);

        console.log(`Applying ${statements.length} statements from ${tag}.sql...`);

        for (const [index, statement] of statements.entries()) {
            try {
                await sql.unsafe(statement);
                console.log(`  ✓ ${index + 1}/${statements.length}`);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (
                    message.includes("already exists") ||
                    message.includes("duplicate key") ||
                    message.includes("duplicate column")
                ) {
                    console.log(`  ⏭ ${index + 1}/${statements.length} (already applied)`);
                    continue;
                }
                throw error;
            }
        }

        console.log("✅ Council evaluation US schema applied");
    }

    const journal = JSON.parse(Deno.readTextFileSync(journalPath)) as {
        entries?: Array<{ tag: string; when: number }>;
    };
    const entry = journal.entries?.find((e) => e.tag === tag);
    if (!entry) {
        console.warn(`⚠ Journal entry missing for ${tag}`);
        Deno.exit(0);
    }

    const content = readFileSync(sqlPath);
    const hash = createHash("sha256").update(content).digest("hex");
    const existing = await sql`
        SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${hash}
    `;
    if (existing.length === 0) {
        await sql`
            INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
            VALUES (${hash}, ${entry.when})
        `;
        console.log(`✅ Recorded migration hash for ${tag}`);
    } else {
        console.log(`⏭ Migration ${tag} already recorded in __drizzle_migrations`);
    }
} catch (error) {
    console.error("❌ Failed to apply 0050 repair", error);
    Deno.exit(1);
} finally {
    await sql.end({ timeout: 5 });
}
