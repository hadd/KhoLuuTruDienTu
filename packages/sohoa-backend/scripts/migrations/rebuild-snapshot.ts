#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

/**
 * Build the latest Drizzle snapshot from current TypeScript schema.
 * Uses a temporary output folder so existing migrations/journal stay intact.
 *
 * Usage (from packages/sohoa-backend):
 *   deno task db:rebuild-snapshot
 */

import { join } from "jsr:@std/path@1";

const backendRoot = new URL("../..", import.meta.url);
const journalPath = join(
  pathFromUrl(backendRoot),
  "db",
  "drizzle",
  "meta",
  "_journal.json",
);
const metaDir = join(pathFromUrl(backendRoot), "db", "drizzle", "meta");
const tempOutDir = join(pathFromUrl(backendRoot), "db", ".drizzle-snapshot-build");

function pathFromUrl(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
}

async function removeDir(path: string) {
  try {
    await Deno.remove(path, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

async function main() {
  const journal = JSON.parse(await Deno.readTextFile(journalPath));
  const entries = journal.entries ?? [];
  if (entries.length === 0) {
    console.error("❌ Journal is empty.");
    Deno.exit(1);
  }

  const lastEntry = entries[entries.length - 1];
  const targetSnapshot = `${String(lastEntry.idx).padStart(4, "0")}_snapshot.json`;

  console.log("🔧 Building Drizzle snapshot from current schema");
  console.log(`   Target: db/drizzle/meta/${targetSnapshot}\n`);

  await removeDir(tempOutDir);
  await Deno.mkdir(join(tempOutDir, "meta"), { recursive: true });
  await Deno.writeTextFile(
    join(tempOutDir, "meta", "_journal.json"),
    JSON.stringify({
      version: journal.version ?? "7",
      dialect: journal.dialect ?? "postgresql",
      entries: [],
    }, null, 2),
  );

  const tempConfigPath = join(pathFromUrl(backendRoot), "drizzle.snapshot.config.ts");
  const tempOutRelative = "./db/.drizzle-snapshot-build";
  await Deno.writeTextFile(
    tempConfigPath,
    `import process from "node:process";
import { env } from "./env.ts";

export default {
  schema: "./db/schemas/index.ts",
  out: "${tempOutRelative}",
  dialect: "postgresql",
  schemaFilter: env.DB_SCHEMA,
  dbCredentials: {
    url: (typeof process !== "undefined" && process.env && process.env.DATABASE_URL) ||
      "postgres://postgres:postgres@localhost:5432/ai_edu",
  },
};
`,
  );

  try {
    console.log("▶ Running drizzle-kit generate in temporary folder...\n");

    const command = new Deno.Command("deno", {
      args: [
        "run",
        "-A",
        "npm:drizzle-kit",
        "generate",
        "--config=drizzle.snapshot.config.ts",
      ],
      cwd: pathFromUrl(backendRoot),
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    const { code } = await command.output();
    if (code !== 0) {
      console.error("\n❌ drizzle-kit generate failed.");
      Deno.exit(code);
    }

    const generatedSnapshotPath = join(tempOutDir, "meta", "0000_snapshot.json");
    const snapshot = await Deno.readTextFile(generatedSnapshotPath);
    await Deno.writeTextFile(join(metaDir, targetSnapshot), snapshot);

    const keptSnapshot = join(metaDir, targetSnapshot);
    for await (const entry of Deno.readDir(metaDir)) {
      if (!entry.isFile || !entry.name.endsWith("_snapshot.json")) continue;
      const filePath = join(metaDir, entry.name);
      if (filePath !== keptSnapshot) {
        await Deno.remove(filePath);
        console.log(`   ✓ Removed stale snapshot: meta/${entry.name}`);
      }
    }

    const generatedSqlFiles: string[] = [];
    for await (const entry of Deno.readDir(tempOutDir)) {
      if (entry.isFile && entry.name.endsWith(".sql")) {
        generatedSqlFiles.push(entry.name);
      }
    }

    console.log(`\n✅ Wrote db/drizzle/meta/${targetSnapshot}`);
    if (generatedSqlFiles.length > 0) {
      console.log(`   (ignored temporary SQL: ${generatedSqlFiles.join(", ")})`);
    }
    console.log("\nVerify with: deno task db:generate");
    console.log("Expected: no new migration / no schema changes.\n");
  } finally {
    try {
      await Deno.remove(tempConfigPath);
    } catch {
      // ignore
    }
    await removeDir(tempOutDir);
    try {
      await Deno.remove(join(pathFromUrl(backendRoot), "db", "meta"), { recursive: true });
    } catch {
      // ignore stray folder from previous failed run
    }
  }
}

if (import.meta.main) {
  await main();
}
