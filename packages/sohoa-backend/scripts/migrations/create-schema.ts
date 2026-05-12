import postgres from "postgres";
import { env } from "../../env.ts";

const schema = env.DB_SCHEMA ?? "ai_edu_app";

const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
try {
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  console.log(`✅ Schema "${schema}" ready`);
} catch (error) {
  console.error("❌ Failed to create schema:", error);
  Deno.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
