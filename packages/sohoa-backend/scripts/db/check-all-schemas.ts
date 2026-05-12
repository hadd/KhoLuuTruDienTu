import { db } from "../../db/db-conn.ts";
import { sql } from "drizzle-orm";

console.log("Checking all schemas and tables...\n");

try {
    const result = await db.execute(sql`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name;
    `);

    let currentSchema = '';
    result.forEach((row: Record<string, unknown>) => {
        const schemaName = String(row.table_schema ?? "");
        const tableName = String(row.table_name ?? "");
        if (schemaName !== currentSchema) {
            currentSchema = schemaName;
            console.log(`\n📁 Schema: ${currentSchema}`);
        }
        console.log(`   - ${tableName}`);
    });

    console.log(`\n✅ Total tables found: ${result.length}`);
} catch (error) {
    console.error("Error:", error);
}

Deno.exit(0);
