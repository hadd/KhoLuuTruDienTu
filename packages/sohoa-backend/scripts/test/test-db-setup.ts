/**
 * Test Database Setup Script
 *
 * Utility script to manually run test database setup.
 * This will run migrations and seed data if needed.
 *
 * Usage:
 *   deno task test:db:setup
 */

import { setupTestDatabase } from "../../tests/helpers/setup.ts";

console.log("🚀 Setting up test database...\n");

try {
    await setupTestDatabase();
    console.log("\n✅ Test database setup complete");
    Deno.exit(0);
} catch (error) {
    console.error("\n❌ Test database setup failed:", error);
    Deno.exit(1);
}
