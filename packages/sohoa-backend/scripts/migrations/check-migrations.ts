import { db } from "../../db/db-conn.ts";
import { sql } from "drizzle-orm";

console.log("Checking applied migrations...\n");

try {
    // Check if the migrations table exists
    const tableCheck = await db.execute(sql`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'drizzle' 
            AND table_name = '__drizzle_migrations'
        );
    `);
    
    if (!tableCheck[0].exists) {
        console.log("❌ Migrations table doesn't exist!");
        Deno.exit(1);
    }
    
    const result = await db.execute(sql`
        SELECT * FROM drizzle.__drizzle_migrations 
        ORDER BY created_at;
    `);
    
    console.log(`Found ${result.length} applied migrations:`);
    result.forEach((row: any, index: number) => {
        console.log(`\n${index + 1}. ${row.hash}`);
        console.log(`   Created: ${row.created_at}`);
    });
} catch (error) {
    console.error("Error:", error);
}

Deno.exit(0);

