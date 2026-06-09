/**
 * Roles Seeding Script
 */

import { eq } from "drizzle-orm";
import { roles } from "../../db/schemas/index.ts";
import { ROLE_DEFINITIONS } from "./data.ts";
import { logger } from "./utils.ts";

/**
 * Create or update roles
 */
export async function seedRoles(db: any) {
    logger.info("🌱 Seeding roles...");

    for (const roleData of ROLE_DEFINITIONS) {
        const existingRole = await db.query.roles.findFirst({
            where: eq(roles.id, roleData.id),
        });

        if (existingRole) {
            await db.update(roles)
                .set({
                    name: roleData.name,
                    description: roleData.description,
                    rules: roleData.rules,
                    isBaseRole: roleData.isBaseRole,
                    updatedAt: new Date(),
                })
                .where(eq(roles.id, roleData.id));
            logger.info(`✅ Updated role: ${roleData.id}`);
        } else {
            await db.insert(roles).values(roleData);
            logger.info(`✅ Created role: ${roleData.name}`);
        }
    }
}
