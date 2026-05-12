#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * Individual Users Seeding Script
 *
 * Usage: deno run --allow-net --allow-env --allow-read scripts/seed/users.ts
 */

import { connectDb, closeDb } from "../../db/db-conn.ts";
import { seedUsers } from "./seed-users.ts";
import { seedRoles } from "./seed-roles.ts";
import { logger } from "./utils.ts";

async function main() {
    logger.info("🚀 Starting users seeding...");

    try {
        const db = connectDb();
        await seedRoles(db);
        await seedUsers(db);
        logger.info("🎉 Users seeding completed successfully!");
    } catch (error) {
        logger.error("❌ Users seeding failed:", error);
        throw error;
    } finally {
        await closeDb();
    }
}

if (import.meta.main) {
    await main();
}
