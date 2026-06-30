import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../../env.ts";

const schema = env.DB_SCHEMA ?? "ai_edu_app";
const migrationsSource = fileURLToPath(new URL("../../db/drizzle", import.meta.url));
const tempDir = join(await Deno.makeTempDir({ prefix: "drizzle-migrate-" }), "drizzle");

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
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: tempDir });
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
