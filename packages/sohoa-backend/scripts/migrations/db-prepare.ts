import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../../env.ts";

async function ensureSchemaExists(sql: postgres.Sql) {
    const schemaName = env.DB_SCHEMA?.trim();
    if (!schemaName) {
        throw new Error("DB_SCHEMA is not set. Define it in your .env or .env.test");
    }
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
}

async function main() {
    console.log("Preparing database...", { NODE_ENV: env.NODE_ENV, DB_SCHEMA: env.DB_SCHEMA });
    const sql = postgres(env.DATABASE_URL, { prepare: true, max: 1 });
    try {
        await ensureSchemaExists(sql);
        const db = drizzle(sql);
        await migrate(db, { migrationsFolder: new URL("../../db/drizzle", import.meta.url).pathname });
        console.log("✅ Database prepared");
    } catch (error) {
        console.error("❌ Database preparation failed", error);
        Deno.exit(1);
    } finally {
        await sql.end({ timeout: 5 });
    }
}

if (import.meta.main) {
    await main();
}


