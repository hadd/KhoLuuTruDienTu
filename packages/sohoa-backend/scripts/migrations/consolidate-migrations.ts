#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run

/**
 * Consolidate migration history into a single baseline migration.
 *
 * Prerequisites:
 * - Database schema must already match current TypeScript schema.
 * - Run pending migrations first (or use mark-pending-applied.ts).
 *
 * Steps performed:
 * 1. clean-migrations  — remove old SQL + snapshots + journal
 * 2. db:generate       — create one baseline migration from current schema
 * 3. reset journal in DB to the new baseline hash
 *
 * Usage (from packages/sohoa-backend):
 *   deno run -A ./scripts/migrations/consolidate-migrations.ts
 */

import { createHash } from "node:crypto";
import { join } from "jsr:@std/path@1";
import postgres from "postgres";
import { env } from "../../env.ts";

const backendRoot = new URL("../..", import.meta.url);
const drizzleDir = join(pathFromUrl(backendRoot), "db", "drizzle");

function pathFromUrl(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
}

async function runTask(task: string): Promise<void> {
  console.log(`\n▶ deno task ${task}\n`);
  const command = new Deno.Command("deno", {
    args: ["task", task],
    cwd: pathFromUrl(backendRoot),
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await command.output();
  if (code !== 0) {
    console.error(`\n❌ deno task ${task} failed with exit code ${code}`);
    Deno.exit(code);
  }
}

async function findBaselineMigration(): Promise<{ file: string; path: string }> {
  const sqlFiles: string[] = [];
  for await (const entry of Deno.readDir(drizzleDir)) {
    if (entry.isFile && entry.name.endsWith(".sql")) {
      sqlFiles.push(entry.name);
    }
  }
  if (sqlFiles.length !== 1) {
    console.error(
      `❌ Expected exactly 1 SQL migration after generate, found ${sqlFiles.length}: ${sqlFiles.join(", ")}`,
    );
    Deno.exit(1);
  }
  const file = sqlFiles[0];
  return { file, path: join(drizzleDir, file) };
}

async function main() {
  console.log("🔧 Consolidating migrations into a single baseline...\n");

  await runTask("db:clean-migrations");
  await runTask("db:generate");

  const { file, path } = await findBaselineMigration();
  const content = await Deno.readTextFile(path);
  const hash = createHash("sha256").update(content).digest("hex");

  const journalPath = join(drizzleDir, "meta", "_journal.json");
  const journal = JSON.parse(await Deno.readTextFile(journalPath));
  const entry = journal.entries?.[0];
  if (!entry) {
    console.error("❌ Journal has no entries after generate.");
    Deno.exit(1);
  }

  const sql = postgres(env.DATABASE_URL, { max: 1 });
  try {
    console.log("\n▶ Resetting drizzle.__drizzle_migrations to baseline...\n");
    await sql.unsafe(`DELETE FROM drizzle.__drizzle_migrations`);
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;
    console.log(`   ✓ Baseline: ${file}`);
    console.log(`   ✓ Hash: ${hash}`);
    console.log(`   ✓ created_at: ${entry.when}`);
  } finally {
    await sql.end();
  }

  console.log("\n▶ Verifying...\n");
  await runTask("db:generate");
  await runTask("db:migrate");

  console.log("\n✅ Migration history consolidated successfully!");
  console.log("   Future workflow: edit schema → deno task db:generate → deno task db:migrate\n");
}

if (import.meta.main) {
  await main();
}
