import { and, eq, isNull } from "drizzle-orm";
import { userProfiles, userRoles } from "../../db/schemas/index.ts";
import { USERS } from "./data.ts";
import { logger } from "./utils.ts";
import { hashPassword } from "../../libs/helpers/password.ts";

export async function seedUsers(db: any) {
    logger.info("🌱 Seeding users...");

    const createdUsers: unknown[] = [];

    for (const userData of USERS) {
        const existingProfile = await db.query.userProfiles.findFirst({
            where: and(eq(userProfiles.email, userData.email), isNull(userProfiles.deletedAt)),
        });

        let userId: string;

        if (existingProfile) {
            logger.info(`✅ User profile ${userData.email} already exists`);
            userId = existingProfile.id;
            createdUsers.push({ ...existingProfile, role: userData.role });
        } else {
            const passwordHash = await hashPassword(userData.password);
            const [newProfile] = await db.insert(userProfiles).values({
                email: userData.email,
                fullName: userData.fullName,
                passwordHash,
            }).returning();
            userId = newProfile.id;
            createdUsers.push({ ...newProfile, role: userData.role });
            logger.info(`✅ Created user profile: ${userData.email}`);
        }

        const existingUserRole = await db.query.userRoles.findFirst({
            where: and(
                eq(userRoles.userId, userId),
                eq(userRoles.roleId, userData.role),
                isNull(userRoles.expiredAt),
            ),
        });

        if (!existingUserRole) {
            await db.insert(userRoles).values({
                userId,
                roleId: userData.role,
            });
            logger.info(`✅ Assigned ${userData.role} role to ${userData.email}`);
        } else {
            logger.info(`✅ Role already assigned to ${userData.email}`);
        }
    }
    return createdUsers;
}
