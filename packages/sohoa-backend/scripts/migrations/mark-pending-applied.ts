#!/usr/bin/env -S deno run --allow-read --allow-env

/**
 * Mark specific pending migrations as applied without running their SQL.
 * Use when schema was applied via db:push but migrations were not recorded.
 *
 * Usage (from packages/sohoa-backend):
 *   deno run -A ./scripts/migrations/mark-pending-applied.ts 0037_peaceful_ultron 0038_bumpy_smiling_tiger
 */

import { createHash } from "node:crypto";
import { join } from "jsr:@std/path@1";
import postgres from "postgres";
import { env } from "../../env.ts";

const backendRoot = new URL("../..", import.meta.url);
const drizzleDir = join(pathFromUrl(backendRoot), "db", "drizzle");
const journalPath = join(drizzleDir, "meta", "_journal.json");

function pathFromUrl(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
}

async function main() {
  const tags = Deno.args;
  if (tags.length === 0) {
    console.error("Usage: deno run -A ./scripts/migrations/mark-pending-applied.ts <tag> [tag...]");
    Deno.exit(1);
  }

  const journal = JSON.parse(await Deno.readTextFile(journalPath));
  const entries: Array<{ tag: string; when: number }> = journal.entries ?? [];

  const sql = postgres(env.DATABASE_URL, { max: 1 });
  try {
    for (const tag of tags) {
      const entry = entries.find((e) => e.tag === tag);
      if (!entry) {
        console.error(`❌ Migration tag not found in journal: ${tag}`);
        Deno.exit(1);
      }

      const filePath = join(drizzleDir, `${tag}.sql`);
      const content = await Deno.readTextFile(filePath);
      const hash = createHash("sha256").update(content).digest("hex");

      const existing = await sql`
        SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${hash}
      `;
      if (existing.length > 0) {
        console.log(`⏭  Already applied: ${tag}`);
        continue;
      }

      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${entry.when})
      `;
      console.log(`✅ Marked applied: ${tag}`);
    }
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  await main();
}
