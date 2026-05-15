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
import { roles } from "../../db/schemas/role.ts";
import { and, eq, isNull } from "drizzle-orm";
import { cache } from "@shared/cache-lib";
import { httpError } from "@shared/common-lib";
import { hashPassword } from "../../libs/helpers/password.ts";
import type { Static } from "elysia";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

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

export const ProfileService = {
    ...crud,

    async createUserWithRole(input: Static<typeof createUserProfileWithRoleSchema>) {
        const { password, roleId: inputRoleId, ...profileData } = input;

        if (!password) {
            throw httpError.badRequest("password is required");
        }

        const passwordHash = await hashPassword(password);

        // Use provided roleId or default to "user"
        const roleId = inputRoleId || "editer";

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

            // Validate role exists
            const existingRole = await tx.query.roles.findFirst({
                where: eq(roles.id, roleId),
            });
            if (!existingRole) {
                throw httpError.badRequest(`Role "${roleId}" not found`);
            }

            const [newUser] = await tx.insert(userProfiles).values({
                ...profileData,
                passwordHash,
            }).returning();
            const userId = newUser.id;

            await tx.insert(userRoles).values({
                userId,
                roleId: roleId,
            });

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
            with: {
                userRoles: {
                    where: activeRoleWhere,
                    with: {
                        role: true,
                    },
                },
            },
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
        return { id: result.id as string };
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

    async getAllActiveUsers() {
        const result = await crud.list({}, { 
            withoutPaging: true,
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

    downloadTemplateExcel(): Uint8Array {
        const templatePath = join(dirname(fileURLToPath(import.meta.url)), "../../assets/user-import-template.xlsx");
        return new Uint8Array(Deno.readFileSync(templatePath));
    },

    async exportUsersExcel() {
        const result = await this.getAllActiveUsers();
        const users = result.items || [];

        const headers = ["Email", "Full Name", "Phone", "Address", "Roles", "Created At", "Deleted At"];

        const data = users.map((user: Record<string, unknown>) => {
            const userRolesList = (user as { userRoles?: Array<{ role?: { name?: string } }> }).userRoles || [];
            const roles = userRolesList.map((ur) => ur.role?.name).filter(Boolean).join(", ");

            return {
                Email: (user as { email?: string }).email || "",
                "Full Name": (user as { fullName?: string }).fullName || "",
                Phone: (user as { phone?: string }).phone || "",
                Address: (user as { address?: string }).address || "",
                Roles: roles,
                "Created At": (user as { createdAt?: Date }).createdAt
                    ? new Date((user as { createdAt: Date }).createdAt).toISOString()
                    : "",
                "Deleted At": (user as { deletedAt?: Date | null }).deletedAt
                    ? new Date((user as { deletedAt: Date | null }).deletedAt!).toISOString()
                    : "",
            };
        });

        const aoaData = [headers, ...data.map((row) => Object.values(row))];
        const ws = XLSX.utils.aoa_to_sheet(aoaData);

        // Auto-fit column widths
        const colWidths: { [key: string]: number } = {};
        headers.forEach((header, idx) => {
            const key = String.fromCharCode(65 + idx);
            colWidths[key] = header.length + 2;
        });
        for (const row of data) {
            Object.values(row).forEach((value, idx) => {
                const key = String.fromCharCode(65 + idx);
                colWidths[key] = Math.max(colWidths[key] || 0, String(value).length + 2);
            });
        }
        ws["!cols"] = headers.map((_, idx) => ({
            wch: Math.min(colWidths[String.fromCharCode(65 + idx)] || 15, 50),
        }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Users");
        return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as Uint8Array;
    },

    async importUsersExcel(fileBuffer: Uint8Array): Promise<{
        success: number;
        failed: number;
        errors: string[];
    }> {
        const wb = XLSX.read(fileBuffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws) as Record<string, string>[];

        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const row of jsonData) {
            try {
                const { email, fullName, password, phone, address, avatarUrl, role } = row;

                if (!email || !password) {
                    errors.push(`Row skipped: missing email or password`);
                    failed++;
                    continue;
                }

                const existingUser = await db.query.userProfiles.findFirst({
                    where: and(
                        eq(userProfiles.email, email),
                        isNull(userProfiles.deletedAt),
                    ),
                });

                if (existingUser) {
                    errors.push(`User with email ${email} already exists`);
                    failed++;
                    continue;
                }

                // Validate role if provided
                let roleId = "user"; // default role
                if (role) {
                    const existingRole = await db.query.roles.findFirst({
                        where: eq(roles.id, role),
                    });
                    if (existingRole) {
                        roleId = existingRole.id;
                    } else {
                        errors.push(`Row skipped: role "${role}" not found, using default "user"`);
                    }
                }

                const passwordHash = await hashPassword(password);

                await db.transaction(async (tx) => {
                    const [newUser] = await tx.insert(userProfiles).values({
                        email,
                        fullName: fullName || null,
                        phone: phone || null,
                        address: address || null,
                        avatarUrl: avatarUrl || null,
                        passwordHash,
                    }).returning();

                    await tx.insert(userRoles).values({
                        userId: newUser.id,
                        roleId: roleId,
                    });
                });

                success++;
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                errors.push(`Error importing row: ${message}`);
                failed++;
            }
        }

        return { success, failed, errors };
    },
};
