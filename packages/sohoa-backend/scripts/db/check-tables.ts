import { db } from "../../db/db-conn.ts";
import { sql } from "drizzle-orm";

console.log("Checking tables in ai_edu_app schema...\n");

try {
    const result = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'ai_edu_app' 
        ORDER BY table_name;
    `);

    console.log(`Found ${result.length} tables:`);
    result.forEach((row: Record<string, unknown>) => {
        console.log(`  - ${row.table_name ?? ""}`);
    });
} catch (error) {
    console.error("Error:", error);
}

Deno.exit(0);
