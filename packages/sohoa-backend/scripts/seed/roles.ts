#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * Individual Roles Seeding Script
 * 
 * Usage: deno run --allow-net --allow-env --allow-read scripts/seed/roles.ts
 */

import { connectDb, closeDb } from "../../db/db-conn.ts";
import { seedRoles } from "./seed-roles.ts";
import { logger } from "./utils.ts";

async function main() {
    logger.info("🚀 Starting roles seeding...");
    
    try {
        const db = connectDb();
        await seedRoles(db);
        logger.info("🎉 Roles seeding completed successfully!");
    } catch (error) {
        logger.error("❌ Roles seeding failed:", error);
        throw error;
    } finally {
        await closeDb();
    }
}

if (import.meta.main) {
    await main();
}
