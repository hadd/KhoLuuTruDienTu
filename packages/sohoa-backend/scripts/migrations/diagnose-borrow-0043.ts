import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { env } from "../../env.ts";

const sql = postgres(env.DATABASE_URL, { max: 1 });
try {
  const reg = await sql`SELECT to_regclass('sohoa_app.archive_borrow_requests') AS reg`;
  console.log("to_regclass:", reg[0]?.reg);

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'sohoa_app' AND table_name LIKE 'archive_borrow%'
    ORDER BY table_name
  `;
  console.log("borrow tables:", tables.map((t) => t.table_name));

  const migrations = await sql`
    SELECT id, hash, created_at FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC LIMIT 10
  `;
  console.log("recent migrations:");
  for (const m of migrations) {
    const created = typeof m.created_at === "bigint" || typeof m.created_at === "number"
      ? new Date(Number(m.created_at)).toISOString()
      : String(m.created_at);
    console.log(" -", m.id, String(m.hash).slice(0, 16), created);
  }

  const content = readFileSync(
    new URL("../../db/drizzle/0043_flowery_joseph.sql", import.meta.url),
  );
  const hash = createHash("sha256").update(content).digest("hex");
  console.log("0043 file hash:", hash);
  const match = await sql`
    SELECT id, hash, created_at FROM drizzle.__drizzle_migrations WHERE hash = ${hash}
  `;
  console.log("0043 in migrations table:", match.length > 0 ? match[0] : null);
} finally {
  await sql.end({ timeout: 5 });
}
