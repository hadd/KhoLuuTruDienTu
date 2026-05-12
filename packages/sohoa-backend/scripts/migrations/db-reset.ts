import { db } from "../../db/db-conn.ts";
import { sql } from "drizzle-orm";
import { env } from "../../env.ts";

/**
 * Reset database by dropping and recreating the schema
 * ⚠️  WARNING: This will delete ALL data in the schema!
 */
const PUBLIC_SCHEMA = "public";
const DRIZZLE_SCHEMA = "drizzle";

async function resetDatabase() {
    console.log("⚠️  WARNING: This will delete ALL data!");
    console.log(`Schema to reset: ${env.DB_SCHEMA}`);
    console.log("");

    if (env.DB_SCHEMA === PUBLIC_SCHEMA) {
        console.log("Using default public schema; skip DROP/CREATE (Postgres does not allow dropping public).");
        console.log("✅ Database reset complete (no schema change).");
        console.log("");
        console.log("Next steps:");
        console.log("  1. Run migrations: deno task db:migrate");
        return;
    }

    try {
        console.log(`🗑️  Dropping schema "${env.DB_SCHEMA}"...`);
        await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${env.DB_SCHEMA} CASCADE;`));
        console.log("✅ Schema dropped");

        console.log(`🗑️  Dropping schema "${DRIZZLE_SCHEMA}" (migration tracking)...`);
        await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${DRIZZLE_SCHEMA} CASCADE;`));
        console.log("✅ Drizzle schema dropped");

        console.log(`🔨 Creating schema "${env.DB_SCHEMA}"...`);
        await db.execute(sql.raw(`CREATE SCHEMA ${env.DB_SCHEMA};`));
        console.log("✅ Schema created");

        console.log("");
        console.log("✅ Database reset complete!");
        console.log("");
        console.log("Next steps:");
        console.log("  1. Run migrations: deno task db:migrate");
        
    } catch (error) {
        console.error("❌ Database reset failed:", error);
        throw error;
    }
}

// Run reset if this script is executed directly
if (import.meta.main) {
    try {
        await resetDatabase();
        Deno.exit(0);
    } catch (error) {
        console.error("❌ Reset failed", error);
        Deno.exit(1);
    }
}

export { resetDatabase };

