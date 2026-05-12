import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { env } from "../env.ts";
import * as schemas from "./schemas/index.ts";
import { logDb } from "@shared/common-lib";
import { createDrizzleDbLogger } from "@shared/db-helper";
export interface DatabaseConfig {
    url?: string;
    schema?: string;
}

let client: ReturnType<typeof postgres> | null = null;
let connection: PostgresJsDatabase<typeof schemas> | null = null;
let currentDatabaseUrl: string | null = null;

export function connectDb(): PostgresJsDatabase<typeof schemas> {
    const databaseUrl = env.DATABASE_URL;

    // Safety check: Warn if connecting to production database in test mode
    if (env.NODE_ENV === "test") {
        const isTestDb = databaseUrl.includes("test") || databaseUrl.includes("huy_test_db");
        if (!isTestDb) {
            logDb.warn("⚠️  WARNING: Test environment detected but database URL doesn't contain 'test'!");
            logDb.warn({ databaseUrl }, "Database URL:");
            logDb.warn("This might indicate tests are running against the wrong database!");
        } else {
            logDb.info({ databaseUrl }, "✅ Test database connection confirmed:");
        }
    }

    // If we already have a connection and the URL hasn't changed, reuse it
    if (connection && currentDatabaseUrl === databaseUrl) {
        return connection;
    }

    // Close existing connection if URL changed
    if (client && currentDatabaseUrl !== databaseUrl) {
        logDb.info("Database URL changed, closing existing connection...");
        client.end({ timeout: 5 }).catch(() => {});
        client = null;
        connection = null;
    }

    logDb.info("Connecting to database...");

    const poolMax = env.DB_POOL_MAX ?? 20;
    client = postgres(databaseUrl, {
        prepare: true,
        max: poolMax,
        idle_timeout: 20,
        connect_timeout: 10, // Connection timeout
        max_lifetime: 60 * 30, // Maximum connection lifetime (30 minutes)
        transform: {
            undefined: null, // Transform undefined to null
        },
    });

    connection = drizzle(client, {
        schema: schemas,
        logger: createDrizzleDbLogger(env.DB_QUERY_LOGS),
    });
    currentDatabaseUrl = databaseUrl;
    logDb.info("Database connected successfully");
    return connection;
}

export function getDb(): PostgresJsDatabase<typeof schemas> {
    return connection ?? connectDb();
}

export async function closeDb() {
    if (client) {
        logDb.info("Closing database connection...");
        await client.end({ timeout: 5 });
        client = null;
        connection = null;
        currentDatabaseUrl = null;
        logDb.info("Database connection closed");
    }
}

// Health check function
export async function checkDatabaseHealth(): Promise<{ status: string; latency?: number }> {
    try {
        const start = Date.now();
        // Ensure connection is established
        getDb();
        if (client) {
            await client`SELECT 1`;
        }
        const latency = Date.now() - start;

        return {
            status: "healthy",
            latency,
        };
    } catch (error) {
        logDb.error({ error }, "Database health check failed");
        return {
            status: "unhealthy",
        };
    }
}

export const db: PostgresJsDatabase<typeof schemas> = getDb();
