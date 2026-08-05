/**
 * Apply 0043_flowery_joseph.sql when Drizzle skipped it because
 * __drizzle_migrations row count already equals journal length
 * (hash of 0043 never recorded, tables missing).
 *
 * Usage (from packages/sohoa-backend):
 *   deno run -A ./scripts/migrations/apply-borrow-0043.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { env } from "../../env.ts";

const sqlFile = fileURLToPath(
  new URL("../../db/drizzle/0043_flowery_joseph.sql", import.meta.url),
);
const content = readFileSync(sqlFile, "utf8");
const hash = createHash("sha256").update(content).digest("hex");

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

function splitStatements(raw: string): string[] {
  return raw
    .split(/-->\s*statement-breakpoint\s*/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

try {
  const existingTable = await sql`
    SELECT to_regclass('sohoa_app.archive_borrow_requests') AS reg
  `;
  const existingHash = await sql`
    SELECT id FROM drizzle.__drizzle_migrations WHERE hash = ${hash}
  `;

  if (existingTable[0]?.reg && existingHash.length > 0) {
    console.log("✅ 0043 already applied (table + hash present)");
    Deno.exit(0);
  }

  if (!existingTable[0]?.reg) {
    console.log("Applying 0043_flowery_joseph.sql ...");
    const statements = splitStatements(content);
    for (const statement of statements) {
      await sql.unsafe(statement);
    }
    console.log(`✅ Executed ${statements.length} statements`);
  } else {
    console.log("Table already exists; will only record migration hash");
  }

  if (existingHash.length === 0) {
    // Drizzle stores created_at as numeric epoch-ms from journal `when`.
    const when = 1785479222103;
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${when})
    `;
    console.log("✅ Recorded hash in drizzle.__drizzle_migrations");
  }

  const verify = await sql`
    SELECT to_regclass('sohoa_app.archive_borrow_requests') AS requests,
           to_regclass('sohoa_app.archive_borrow_items') AS items,
           to_regclass('sohoa_app.archive_borrow_dip_packages') AS dip
  `;
  console.log("verify:", verify[0]);
} catch (error) {
  console.error("❌ Failed to apply 0043", error);
  Deno.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
