import postgres from "postgres";
import { sql } from "drizzle-orm";
import { DATABASE_URL } from "@shared/test-vars";
import { getTestDb, closeTestDb } from "./db.ts";

export const TEST_SCHEMA = "test_base_service";
/**
 * Setup test database by creating schema and pushing schema changes
 * Uses drizzle-kit push for codebase-first approach
 */
export async function setupTestDatabase(createSchema: boolean = false): Promise<void> {
    const db = getTestDb();
    
    if (createSchema) {
        await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`));
        await pushSchema();
    }
}

/**
 * Push schema to database using drizzle-kit push
 */
async function pushSchema(): Promise<void> {
    const configPath = new URL("./drizzle.config.ts", import.meta.url).pathname;
  
    const command = new Deno.Command("deno", {
        args: [
            "run",
            "-A",
            "npm:drizzle-kit@latest",
            "push",
            "--config",
            configPath,
        ],
        stdout: "piped",
        stderr: "piped",
        cwd: new URL("../../../", import.meta.url).pathname,
        env: {DATABASE_URL},
    });
    
    const { code, stdout, stderr } = await command.output();
    const stdoutText = new TextDecoder().decode(stdout);
    const stderrText = new TextDecoder().decode(stderr);
    
    if (code !== 0) {
        const errorMessage = stderrText || stdoutText;
        throw new Error(`Schema push failed with exit code ${code}:\n${errorMessage}`);
    }
    
    if (stderrText && 
        !stderrText.includes("No schema changes") && 
        !stderrText.includes("No changes detected") &&
        !stderrText.includes("No difference") &&
        !stderrText.includes("cannot drop schema") &&
        !stderrText.includes("because other objects depend on it")) {
        console.log(`Schema push output: ${stderrText}`);
    }
    
    const db = getTestDb();
    const tables = ["authors", "publishers", "books", "book_details", "genres", "book_genres", "hard_delete_items"];
    for (const table of tables) {
        const result = await db.execute(sql.raw(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = '${TEST_SCHEMA}' 
                AND table_name = '${table}'
            );
        `));
        const exists = (result as any)[0]?.exists;
        if (!exists) {
            throw new Error(`Table '${TEST_SCHEMA}.${table}' was not created after schema push`);
        }
    }
}

/**
 * Teardown test database
 */
export async function teardownTestDatabase(): Promise<void> {
    await closeTestDb();
}

/**
 * Drop test schema completely
 */
export async function dropTestSchema(): Promise<void> {
    await closeTestDb();
    
    const resetClient = postgres(DATABASE_URL, {
        max: 1,
        onnotice: () => {},
    });
    
    try {
        await resetClient.unsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
        console.log(`✅ Schema '${TEST_SCHEMA}' dropped`);
    } catch (error) {
        console.error(`❌ Failed to drop schema '${TEST_SCHEMA}':`, error);
        throw error;
    } finally {
        await resetClient.end({ timeout: 5 });
    }
}

/**
 * Truncate test tables seed reset  test database
 */
export async function truncateTestTables(tables?: string[]): Promise<void> {
    const db = getTestDb();
    
    const allTables = ["book_genres", "book_details", "books", "genres", "authors", "publishers", "hard_delete_items"];
    const tablesToTruncate = tables || allTables;
    
    // Truncate in reverse dependency order
    const truncateOrder = ["book_genres", "book_details", "books", "genres", "authors", "publishers", "hard_delete_items"];
    const orderedTables = truncateOrder.filter(table => tablesToTruncate.includes(table));
    
    for (const table of orderedTables) {
        await db.execute(sql.raw(`TRUNCATE TABLE "${TEST_SCHEMA}"."${table}" CASCADE`));
    }
}

// Re-export getTestDb for convenience
export { getTestDb, closeTestDb } from "./db.ts";

export const TEST_OPTS = {
    sanitizeOps: false,
    sanitizeResources: false,
} as const;

