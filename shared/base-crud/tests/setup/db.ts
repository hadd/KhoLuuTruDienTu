import { DATABASE_URL } from "@shared/test-vars";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { testSchema } from "./schema.ts";

let testClient: ReturnType<typeof postgres> | null = null;
let testDb: PostgresJsDatabase<typeof testSchema> | null = null;
export function getTestDb(): PostgresJsDatabase<typeof testSchema> {
    if (testDb && testClient) {
        return testDb;
    }

    testClient = postgres(DATABASE_URL, {
        prepare: true,
        max: 50,
        idle_timeout: 0,
        connect_timeout: 5,
        max_lifetime: 0,
        transform: {
            undefined: null,
        },
        onnotice: () => {},
    });

    testDb = drizzle(testClient, { schema: testSchema });

    return testDb!;
}

export async function closeTestDb(): Promise<void> {
    if (testClient) {
        try {
            await testClient.end({ timeout: 5 });
        } catch (_error) {
            // Ignore errors if connection is already closed or closing
            // This prevents test failures from connection cleanup issues
        } finally {
            testClient = null;
            testDb = null;
        }
    }
}

