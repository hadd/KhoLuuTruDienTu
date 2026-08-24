/**
 * Main Seeding Orchestrator
 * 
 * This script coordinates all seeding operations
 */

import { connectDb, closeDb } from "../../db/db-conn.ts";
import { seedUsers } from "./seed-users.ts";
import { seedRoles } from "./seed-roles.ts";
import { seedSecurityPermissionDefs, seedSecurityLevels } from "./seed-security-levels.ts";
import { USERS } from "./data.ts";
import { logger } from "./utils.ts";

/**
 * Main seeding function
 */
export async function seed() {
    logger.info("🚀 Starting database seeding...");
    
    try {
        const db = connectDb();

        // Seed in order of dependencies
        await seedRoles(db);
        await seedUsers(db);
        await seedSecurityPermissionDefs(db);
        await seedSecurityLevels(db);
        
        logger.info("🎉 Database seeding completed successfully!");
        
        // Print summary
        logger.info("\n📊 Seeding Summary:");
        logger.info(`- Users: ${USERS.length} (Admin)`);
        
        logger.info("\n🔑 Login Credentials:");
        for (const user of USERS) {
            logger.info(`- ${user.role}: ${user.email} / ${user.password}`);
        }

        logger.info("\n🔑 Database seeding completed successfully!");
        return true;
    } catch (error) {
        logger.error("❌ Seeding failed:", error);
        throw error;
    }
}

// Run seeding if this script is executed directly. closeDb + exit(0) to avoid pino transport flush timeout on process exit.
if (import.meta.main) {
    try {
        await seed();
        await closeDb();
        Deno.exit(0);
    } catch (error: any) {
        logger.error("❌ Seeding failed:", error);
        await closeDb();
        Deno.exit(1);
    }
}
