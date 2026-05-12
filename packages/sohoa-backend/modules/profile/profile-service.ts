import { createCrudService } from "@shared/base-crud";
import { db } from "../../db/db-conn.ts";
import {
    createUserProfileSchema,
    createUserProfileWithRoleSchema,
    updateUserProfileSchema,
    type UserProfile,
    userProfiles,
} from "../../db/schemas/user_profile.ts";
import { authSessions, authSessionTokens, userRoles } from "../../db/schemas/index.ts";
import { and, eq, isNull } from "drizzle-orm";
import { cache } from "@shared/cache-lib";
import { httpError } from "@shared/common-lib";
import { hashPassword } from "../../libs/helpers/password.ts";
import type { Static } from "elysia";

export function stripProfileSecrets<T extends { passwordHash?: string | null }>(p: T | null | undefined) {
    if (!p) {
        return p;
    }
    const { passwordHash: _p, ...rest } = p;
    return rest;
}

const activeRoleWhere = isNull(userRoles.expiredAt);

const crud = createCrudService({
    db,
    table: userProfiles,
    searchable: ["email", "fullName"],
    returning: userProfiles,
    createSchema: createUserProfileSchema,
    updateSchema: updateUserProfileSchema,
    relationTables: {
        userRoles: userRoles,
    },
    relationForeignKeys: {
        userRoles: userRoles.userId,
    },
});

async function ensureAdminRoleTx(tx: typeof db, userId: string) {
    const existing = await tx.query.userRoles.findFirst({
        where: and(
            eq(userRoles.userId, userId),
            eq(userRoles.roleId, "admin"),
            activeRoleWhere,
        ),
    });
    if (existing) {
        return;
    }
    await tx.insert(userRoles).values({
        userId,
        roleId: "admin",
    });
}

export const ProfileService = {
    ...crud,

    async createUserWithRole(input: Static<typeof createUserProfileWithRoleSchema>) {
        const { password, ...profileData } = input;

        if (!password) {
            throw httpError.badRequest("password is required");
        }

        const passwordHash = await hashPassword(password);

        return await db.transaction(async (tx) => {
            const email = profileData.email;

            const existingProfile = await tx.query.userProfiles.findFirst({
                where: and(
                    eq(userProfiles.email, email),
                    isNull(userProfiles.deletedAt),
                ),
            });

            if (existingProfile) {
                throw httpError.badRequest(`User with email ${email} already exists`);
            }

            const [newUser] = await tx.insert(userProfiles).values({
                ...profileData,
                passwordHash,
            }).returning();
            const userId = newUser.id;

            await ensureAdminRoleTx(tx, userId);

            await ProfileService.clearProfileCache(userId);

            const userWithRoles = await tx.query.userProfiles.findFirst({
                where: eq(userProfiles.id, userId),
                with: {
                    userRoles: {
                        where: activeRoleWhere,
                        with: {
                            role: true,
                        },
                    },
                },
            });

            return stripProfileSecrets(userWithRoles) as UserProfile & { userRoles: unknown[] };
        });
    },

    async getByEmail(email: string): Promise<UserProfile | null> {
        const profile = await db.query.userProfiles.findFirst({
            where: and(
                eq(userProfiles.email, email),
                isNull(userProfiles.deletedAt),
            ),
        });
        return profile ?? null;
    },

    async clearProfileCache(userId: string): Promise<void> {
        await cache.user.delete(`profile:${userId}`);
    },

    async deleteUser(userId: string): Promise<{ id: string }> {
        const now = new Date();
        await db.update(authSessions).set({ revokedAt: now }).where(
            and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)),
        );
        await db.update(authSessionTokens).set({ revokedAt: now }).where(
            and(eq(authSessionTokens.userId, userId), isNull(authSessionTokens.revokedAt)),
        );
        const result = await crud.delete(userId);
        await this.clearProfileCache(userId);
        return result;
    },

    async resetPassword(userId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
        if (!userId || !newPassword) {
            throw httpError.badRequest("userId and newPassword are required");
        }

        if (newPassword.length < 6) {
            throw httpError.badRequest("Password must be at least 6 characters");
        }

        const userProfile = await db.query.userProfiles.findFirst({
            where: and(
                eq(userProfiles.id, userId),
                isNull(userProfiles.deletedAt),
            ),
        });

        if (!userProfile) {
            throw httpError.notFound(`User with id ${userId} not found`);
        }

        const passwordHash = await hashPassword(newPassword);
        const now = new Date();
        await db.update(userProfiles).set({
            passwordHash,
            updatedAt: now,
        }).where(eq(userProfiles.id, userId));

        await db.update(authSessions).set({ revokedAt: now }).where(
            and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)),
        );
        await db.update(authSessionTokens).set({ revokedAt: now }).where(
            and(eq(authSessionTokens.userId, userId), isNull(authSessionTokens.revokedAt)),
        );

        await this.clearProfileCache(userId);

        return {
            success: true,
            message: "Password reset successfully",
        };
    },

    async removeRole(userId: string, roleId: string) {
        if (!userId || !roleId) {
            throw httpError.badRequest("UserId and roleId are required");
        }

        const existingRole = await db.query.userRoles.findFirst({
            where: and(
                eq(userRoles.userId, userId),
                eq(userRoles.roleId, roleId),
                activeRoleWhere,
            ),
        });

        if (!existingRole) {
            throw httpError.notFound("Role assignment not found");
        }

        await db.update(userRoles)
            .set({
                expiredAt: new Date(),
            })
            .where(eq(userRoles.id, existingRole.id));

        await this.clearProfileCache(userId);

        return { id: existingRole.id, status: "removed" };
    },

    async getUserRoles(userId: string) {
        const roles = await db.query.userRoles.findMany({
            where: eq(userRoles.userId, userId),
            with: {
                role: true,
            },
            orderBy: (userRoles, { desc }) => [desc(userRoles.createdAt)],
        });

        return roles;
    },

    async getUsersWithRoles(query: unknown, options?: unknown) {
        const result = await crud.list(query as never, {
            ...(options as object),
            withOverride: {
                userRoles: {
                    where: activeRoleWhere,
                    with: {
                        role: true,
                    },
                },
            },
        });

        return result;
    },
};
