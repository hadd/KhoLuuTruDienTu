import { createHash } from "node:crypto";
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../../env.ts";

const schema = env.DB_SCHEMA ?? "ai_edu_app";
const migrationsSource = fileURLToPath(new URL("../../db/drizzle", import.meta.url));
const tempDir = join(await Deno.makeTempDir({ prefix: "drizzle-migrate-" }), "drizzle");

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listJournalTags(folder: string): string[] {
  const journalPath = join(folder, "meta", "_journal.json");
  if (!existsSync(journalPath)) return [];
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries?: Array<{ tag: string }>;
  };
  return (journal.entries ?? []).map((e) => e.tag);
}

const sql = postgres(env.DATABASE_URL, { prepare: true, max: 1 });
try {
  cpSync(migrationsSource, tempDir, { recursive: true });
  for (const e of Deno.readDirSync(tempDir)) {
    if (e.isFile && e.name.endsWith(".sql")) {
      const path = join(tempDir, e.name);
      let content = Deno.readTextFileSync(path);
      content = content.replaceAll(/CREATE SCHEMA "([^"]+)";/g, 'CREATE SCHEMA IF NOT EXISTS "$1";');
      Deno.writeTextFileSync(path, content);
    }
  }

  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await sql.unsafe(`SET lock_timeout = '30s'`);

  const journalTags = listJournalTags(tempDir);
  const appliedRows = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const appliedHashes = new Set(appliedRows.map((r) => String(r.hash)));
  const pendingByHash = journalTags.filter((tag) => {
    const file = join(tempDir, `${tag}.sql`);
    if (!existsSync(file)) return false;
    return !appliedHashes.has(sha256File(file));
  });

  console.log(
    `[migrate] journal=${journalTags.length} applied_rows=${appliedRows.length} pending_by_hash=${pendingByHash.length}`,
  );
  if (pendingByHash.length > 0) {
    console.log(`[migrate] pending (by hash): ${pendingByHash.join(", ")}`);
    if (appliedRows.length >= journalTags.length) {
      console.warn(
        "[migrate] WARNING: applied row count >= journal length, so drizzle migrator may SKIP pending SQL even though hashes differ. Use a targeted apply script if tables are missing.",
      );
    }
  }

  const beforeCount = appliedRows.length;
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: tempDir });

  const afterRows = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const newlyApplied = afterRows.length - beforeCount;
  console.log(
    `[migrate] newly_recorded=${newlyApplied} applied_rows_now=${afterRows.length}`,
  );
  console.log("✅ Migration completed");
} catch (error) {
  console.error("❌ Migration failed", error);
  Deno.exit(1);
} finally {
  await sql.end({ timeout: 5 });
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
}
