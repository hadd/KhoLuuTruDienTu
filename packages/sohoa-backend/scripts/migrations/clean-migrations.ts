#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Clean Migrations Script
 * 
 * This script removes all existing migration files and resets the migration journal,
 * allowing you to start with a fresh migration tree.
 * 
 * Usage:
 *   deno run -A ./scripts/migrations/clean-migrations.ts
 * 
 * After running this script:
 *   1. Run: deno task db:generate  (to create a fresh initial migration)
 *   2. Run: deno task db:reset     (to reset database)
 *   3. Run: deno task db:migrate   (to apply the fresh migration)
 */

import { join } from "jsr:@std/path@1";

function pathFromUrl(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
}

const DRIZZLE_DIR = pathFromUrl(new URL("../../db/drizzle", import.meta.url));
const META_DIR = join(DRIZZLE_DIR, "meta");

async function cleanMigrations() {
  console.log("🧹 Cleaning migration tree...\n");

  try {
    // Get all files in drizzle directory
    const entries = [];
    for await (const entry of Deno.readDir(DRIZZLE_DIR)) {
      if (entry.isFile && entry.name.endsWith(".sql")) {
        entries.push(entry.name);
      }
    }

    // Delete all SQL migration files
    console.log("📂 Removing SQL migration files:");
    for (const file of entries) {
      const filePath = join(DRIZZLE_DIR, file);
      await Deno.remove(filePath);
      console.log(`   ✓ Deleted: ${file}`);
    }

    // Get all snapshot files in meta directory
    const metaEntries = [];
    for await (const entry of Deno.readDir(META_DIR)) {
      if (entry.isFile && entry.name.match(/^\d+_snapshot\.json$/)) {
        metaEntries.push(entry.name);
      }
    }

    // Delete all snapshot JSON files
    console.log("\n📂 Removing snapshot files:");
    for (const file of metaEntries) {
      const filePath = join(META_DIR, file);
      await Deno.remove(filePath);
      console.log(`   ✓ Deleted: meta/${file}`);
    }

    // Reset the journal file
    const journalPath = join(META_DIR, "_journal.json");
    const freshJournal = {
      version: "7",
      dialect: "postgresql",
      entries: []
    };
    
    await Deno.writeTextFile(
      journalPath,
      JSON.stringify(freshJournal, null, 2)
    );
    console.log("\n📝 Reset migration journal");

    console.log("\n✅ Migration tree cleaned successfully!\n");
    console.log("Next steps:");
    console.log("  1. Run: deno task db:generate");
    console.log("  2. Run: deno task db:reset");
    console.log("  3. Run: deno task db:migrate");
    console.log("  4. Run migrations: deno task db:migrate\n");

  } catch (error) {
    console.error("❌ Error cleaning migrations:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await cleanMigrations();
}

