import { createHash } from "node:crypto";
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
      content = content.replaceAll(/CREATE TABLE /gi, 'CREATE TABLE IF NOT EXISTS ');
      content = content.replaceAll(/ADD COLUMN /gi, 'ADD COLUMN IF NOT EXISTS ');
      if (schema !== "sohoa_app") {
        content = content.replaceAll(/"sohoa_app"/g, `"${schema}"`);
      }
      Deno.writeTextFileSync(path, content);
    }
  }

  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "sohoa_app"`);
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
  await sql.unsafe(`SET lock_timeout = '30s'`);

  const journalTags = listJournalTags(tempDir);
  let appliedRows: Array<{ hash: unknown }> = [];
  try {
    appliedRows = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  } catch {
    appliedRows = [];
  }
  const appliedHashes = new Set(appliedRows.map((r) => String(r.hash)));
  const pendingTags = journalTags.filter((tag) => {
    const file = join(tempDir, `${tag}.sql`);
    if (!existsSync(file)) return false;
    return !appliedHashes.has(sha256File(file));
  });

  console.log(
    `[migrate] journal=${journalTags.length} applied_rows=${appliedRows.length} pending=${pendingTags.length}`,
  );

  const ignorableCodes = new Set([
    "42701", // duplicate_column
    "42P07", // duplicate_table / duplicate_relation
    "42710", // duplicate_object (type, constraint, etc)
    "42P06", // duplicate_schema
    "42704", // undefined_object
    "42622", // identifier_too_long
    "23505", // unique_violation
  ]);

  let newlyApplied = 0;
  for (const tag of pendingTags) {
    const file = join(tempDir, `${tag}.sql`);
    const fileContent = Deno.readTextFileSync(file);
    const statements = fileContent
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await sql.unsafe(stmt);
      } catch (err: any) {
        if (ignorableCodes.has(err?.code)) {
          console.warn(`[migrate] [${tag}] Ignored non-critical notice/error [${err.code}]: ${err.message}`);
        } else {
          console.error(`[migrate] [${tag}] Error executing statement: ${stmt}`);
          throw err;
        }
      }
    }

    const hash = sha256File(file);
    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${BigInt(Date.now())})`;
    newlyApplied++;
  }

  const afterRows = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  console.log(
    `[migrate] newly_recorded=${newlyApplied} applied_rows_now=${afterRows.length}`,
  );
  console.log("✅ Migration completed successfully");
} catch (error) {
  console.error("❌ Migration failed", error);
  Deno.exit(1);
} finally {
  await sql.end({ timeout: 5 });
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
}
