/**
 * Test Database Reset Script
 *
 * Utility script to force-reset the test database.
 * This drops the schema and recreates everything from scratch.
 *
 * Usage:
 *   deno task test:db:reset
 */

import { resetTestDatabase } from "../../tests/helpers/setup.ts";

console.log("🔄 Resetting test database...\n");

try {
    await resetTestDatabase(true);
    console.log("\n✅ Test database reset complete");
    Deno.exit(0);
} catch (error) {
    console.error("\n❌ Test database reset failed:", error);
    Deno.exit(1);
}
