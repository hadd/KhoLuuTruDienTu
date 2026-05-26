import { createCrudService } from "@shared/base-crud";
import { db } from "../../db/db-conn.ts";
import {
    createUserProfileSchema,
    createUserProfileWithRoleSchema,
    patchUserStatusSchema,
    updateUserProfileSchema,
    updateUserProfileWithRoleSchema,
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
import ExcelJS from "exceljs";

// Types for validation errors
interface CellError {
    row: number;
    col: number;
    error: string;
}

interface ParsedRow {
    rowNumber: number;
    email: string;
    password: string;
    fullName: string;
    phone: string;
    address: string;
    role: string;
    gender: string;
    dateOfBirth: string;
}

const USER_IMPORT_COLUMNS = {
    EMAIL: 1,
    PASSWORD: 2,
    FULL_NAME: 3,
    PHONE: 4,
    ADDRESS: 5,
    ROLE: 6,
    GENDER: 7,
    DATE_OF_BIRTH: 8,
} as const;

const USER_IMPORT_HEADERS = [
    "Email",
    "Password",
    "Full Name",
    "Phone",
    "Address",
    "Role",
    "Gender",
    "DateOfBirth",
] as const;

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

    async patchUserStatus(
        userId: string,
        input: Static<typeof patchUserStatusSchema>,
    ) {
        const conditions = [eq(userProfiles.id, userId), isNull(userProfiles.deletedAt)];
        const [updatedProfile] = await db
            .update(userProfiles)
            .set({ active: input.active, updatedAt: new Date() })
            .where(and(...conditions))
            .returning();

        if (!updatedProfile) {
            throw httpError.notFound("User not found");
        }

        await this.clearProfileCache(userId);

        return stripProfileSecrets(updatedProfile) as UserProfile;
    },

    async updateUserWithRole(
        userId: string,
        input: Static<typeof updateUserProfileWithRoleSchema>,
    ) {
        const { roleId, ...profileData } = input;

        return await db.transaction(async (tx) => {
            // Update user profile using crud update but with tx
            const conditions = [eq(userProfiles.id, userId), isNull(userProfiles.deletedAt)];
            const [updatedProfile] = await tx
                .update(userProfiles)
                .set({ ...profileData, updatedAt: new Date() })
                .where(and(...conditions))
                .returning();

            if (!updatedProfile) {
                throw httpError.notFound("User not found");
            }

            if (roleId) {
                // Validate role exists
                const existingRole = await tx.query.roles.findFirst({
                    where: eq(roles.id, roleId),
                });
                if (!existingRole) {
                    throw httpError.badRequest(`Role "${roleId}" not found`);
                }

                // Check if user already has this role active
                const existingActiveRole = await tx.query.userRoles.findFirst({
                    where: and(
                        eq(userRoles.userId, userId),
                        eq(userRoles.roleId, roleId),
                        activeRoleWhere,
                    ),
                });

                if (!existingActiveRole) {
                    // Expire all current active roles
                    await tx.update(userRoles)
                        .set({ expiredAt: new Date() })
                        .where(and(eq(userRoles.userId, userId), activeRoleWhere));

                    // Insert new role assignment
                    await tx.insert(userRoles).values({
                        userId,
                        roleId,
                    });
                }
            }

            await this.clearProfileCache(userId);

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

    async getAllRoles() {
        const result = await db.query.roles.findMany({
            where: isNull(roles.deletedAt),
            with: {
                userRoles: {
                    where: activeRoleWhere,
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

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Users");

        worksheet.addRow([...USER_IMPORT_HEADERS]);

        // Style headers
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "4472C4" },
            };
            cell.font = { bold: true, color: { argb: "FFFFFF" } };
            cell.alignment = { horizontal: "center" };
        });

        // Add data rows
        for (const user of users) {
            const userRolesList = (user as { userRoles?: Array<{ role?: { name?: string } }> }).userRoles || [];
            const rolesStr = userRolesList.map((ur) => ur.role?.name).filter(Boolean).join(", ");

            worksheet.addRow([
                (user as { email?: string }).email || "",
                "",
                (user as { fullName?: string }).fullName || "",
                (user as { phone?: string }).phone || "",
                (user as { address?: string }).address || "",
                rolesStr,
                (user as { gender?: string }).gender || "",
                (user as { dateOfBirth?: string | Date }).dateOfBirth ? String((user as { dateOfBirth?: string | Date }).dateOfBirth).split("T")[0] : "",
            ]);
        }

        // Auto-fit columns
        worksheet.columns.forEach((column) => {
            let maxLength = 10;
            column.eachCell?.({ includeEmpty: true }, (cell) => {
                const cellLength = String(cell.value || "").length;
                if (cellLength > maxLength) {
                    maxLength = cellLength;
                }
            });
            column.width = Math.min(maxLength + 2, 50);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return new Uint8Array(buffer as ArrayBuffer);
    },

    async importUsersExcel(fileBuffer: Uint8Array): Promise<{
        success: number;
        failed: number;
        successCount: number;
        failedCount: number;
        errors: string[];
        errorFile?: Uint8Array;
    }> {
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = fileBuffer.slice().buffer as ArrayBuffer;
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
            return { success: 0, failed: 0, successCount: 0, failedCount: 0, errors: ["No worksheet found in workbook"] };
        }

        const rows: ParsedRow[] = [];
        const col = USER_IMPORT_COLUMNS;
        const colNames = ["", ...USER_IMPORT_HEADERS];

        const toString = (val: unknown): string => {
            if (val === null || val === undefined) return "";
            return String(val);
        };

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const cellValues = row.values as (unknown | undefined)[];
            const parsedRow: ParsedRow = {
                rowNumber,
                email: toString(cellValues[col.EMAIL]),
                password: toString(cellValues[col.PASSWORD]),
                fullName: toString(cellValues[col.FULL_NAME]),
                phone: toString(cellValues[col.PHONE]),
                address: toString(cellValues[col.ADDRESS]),
                role: toString(cellValues[col.ROLE]),
                gender: toString(cellValues[col.GENDER]),
                dateOfBirth: toString(cellValues[col.DATE_OF_BIRTH]),
            };

            const isEmptyRow = !parsedRow.email.trim()
                && !parsedRow.password.trim()
                && !parsedRow.fullName.trim()
                && !parsedRow.phone.trim()
                && !parsedRow.address.trim()
                && !parsedRow.role.trim()
                && !parsedRow.gender.trim()
                && !parsedRow.dateOfBirth.trim();
            if (isEmptyRow) return;

            rows.push(parsedRow);
        });

        // Phase 1: Validate all rows synchronously (without DB check)
        const cellErrors: Map<number, Map<number, string>> = new Map();
        const emailErrors: Map<string, number> = new Map();

        for (const row of rows) {
            const rowErrors = new Map<number, string>();

            const emailVal = row.email.trim();
            if (!emailVal) {
                rowErrors.set(col.EMAIL, "Email is required");
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
                rowErrors.set(col.EMAIL, "Invalid email format");
            } else if (emailErrors.has(emailVal.toLowerCase())) {
                rowErrors.set(col.EMAIL, `Duplicate email (same as row ${emailErrors.get(emailVal.toLowerCase())!})`);
            } else {
                emailErrors.set(emailVal.toLowerCase(), row.rowNumber);
            }

            const rawPhone = row.phone.trim();
            const cleanedPhone = rawPhone.replace(/[\s\.\-]/g, '');

            if (cleanedPhone) {
                const phoneRegex = /^0\d{9}$/;
                if (!phoneRegex.test(cleanedPhone)) {
                    rowErrors.set(col.PHONE, "Số điện thoại không hợp lệ (phải bắt đầu bằng 0 và có đúng 10 chữ số)");
                } else {
                    row.phone = cleanedPhone;
                }
            }

            const genderVal = row.gender.trim();
            if (genderVal) {
                const validGenders = ["male", "female", "other", "unspecified"];
                if (!validGenders.includes(genderVal.toLowerCase())) {
                    rowErrors.set(col.GENDER, `Invalid gender "${genderVal}". Must be male, female, other, or unspecified`);
                }
            }

            const dobVal = row.dateOfBirth.trim();
            if (dobVal) {
                const parsedDate = new Date(dobVal);
                if (isNaN(parsedDate.getTime())) {
                    rowErrors.set(col.DATE_OF_BIRTH, "Invalid date of birth format");
                }
            }

            const passwordVal = row.password.trim();
            if (!passwordVal) {
                rowErrors.set(col.PASSWORD, "Password is required");
            } else if (passwordVal.length < 8) {
                rowErrors.set(col.PASSWORD, "Password must be at least 8 characters");
            }

            if (rowErrors.size > 0) {
                cellErrors.set(row.rowNumber, rowErrors);
            }
        }

        // Phase 2: Validate roles asynchronously (need DB check)
        for (const row of rows) {
            const roleVal = row.role.trim();
            if (roleVal) {
                const existingRole = await db.query.roles.findFirst({
                    where: eq(roles.id, roleVal),
                });
                if (!existingRole) {
                    const rowErrMap = cellErrors.get(row.rowNumber) || new Map<number, string>();
                    rowErrMap.set(col.ROLE, `Role "${roleVal}" not found`);
                    cellErrors.set(row.rowNumber, rowErrMap);
                }
            }
        }

        // Phase 3: Check for duplicate emails in DB
        for (const row of rows) {
            const emailVal = row.email.trim();
            if (!emailVal) continue; // Skip if already has error

            const rowErrMap = cellErrors.get(row.rowNumber);
            if (rowErrMap && rowErrMap.has(col.EMAIL)) continue;

            const existingUser = await db.query.userProfiles.findFirst({
                where: and(
                    eq(userProfiles.email, emailVal),
                    isNull(userProfiles.deletedAt),
                ),
            });

            if (existingUser) {
                const rowErr = cellErrors.get(row.rowNumber) || new Map<number, string>();
                rowErr.set(col.EMAIL, `User with email "${emailVal}" already exists`);
                cellErrors.set(row.rowNumber, rowErr);
            }
        }

        // Separate valid and invalid rows
        const validRows = rows.filter((row) => !cellErrors.has(row.rowNumber));
        const invalidRows = rows.filter((row) => cellErrors.has(row.rowNumber));

        // Phase 4: Import valid rows into database
        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const row of validRows) {
            try {
                const passwordHash = await hashPassword(row.password);
                let roleId = "editer"; // Default role
                if (row.role.trim()) {
                    const existingRole = await db.query.roles.findFirst({
                        where: eq(roles.id, row.role),
                    });
                    if (existingRole) {
                        roleId = existingRole.id;
                    }
                }

                await db.transaction(async (tx) => {
                    const [newUser] = await tx.insert(userProfiles).values({
                        email: row.email,
                        fullName: row.fullName || null,
                        phone: row.phone || null,
                        address: row.address || null,
                        gender: row.gender.trim() || null,
                        dateOfBirth: row.dateOfBirth.trim() || null,
                        passwordHash,
                    }).returning();

                    await tx.insert(userRoles).values({
                        userId: newUser.id,
                        roleId: roleId,
                    });
                });

                success++;
            } catch (err) {
                errors.push(`Row ${row.rowNumber}: ${err instanceof Error ? err.message : "Unknown error"}`);
                failed++;
            }
        }

        // Phase 5: Create error Excel file ONLY with failed rows (red highlighted)
        let errorFile: Uint8Array | undefined;
        if (invalidRows.length > 0) {
            const errorWorkbook = new ExcelJS.Workbook();
            const errorSheet = errorWorkbook.addWorksheet("Failed Rows");

            // Add title row
            errorSheet.addRow(["FAILED ACCOUNTS - Data Validation Errors"]);
            errorSheet.mergeCells(1, 1, 1, 9);
            errorSheet.getRow(1).getCell(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
            errorSheet.getRow(1).getCell(1).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFCC0000" },
            };
            errorSheet.getRow(1).getCell(1).alignment = { horizontal: "center" };

            // Add summary
            errorSheet.addRow([]);
            errorSheet.addRow(["Total Rows", rows.length.toString()]);
            errorSheet.addRow(["Successful", success.toString()]);
            errorSheet.addRow(["Failed", invalidRows.length.toString()]);
            errorSheet.addRow([]);

            // Add headers
            const headers = [...USER_IMPORT_HEADERS, "Error Details"];
            const headerRow = errorSheet.addRow(headers);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "4472C4" },
                };
                cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                cell.alignment = { horizontal: "center" };
            });

            // Add only the invalid rows with red highlighting
            for (const parsedRow of invalidRows) {
                const rowNum = parsedRow.rowNumber;
                const rowErrors = cellErrors.get(rowNum);

                // Get all error messages for this row
                const errorMessages: string[] = [];
                if (rowErrors) {
                    rowErrors.forEach((errMsg, colIdx) => {
                        errorMessages.push(`${colNames[colIdx]}: ${errMsg}`);
                    });
                }

                const rowData = [
                    parsedRow.email || "",
                    parsedRow.password || "",
                    parsedRow.fullName || "",
                    parsedRow.phone || "",
                    parsedRow.address || "",
                    parsedRow.role || "",
                    parsedRow.gender || "",
                    parsedRow.dateOfBirth || "",
                    errorMessages.join("; "),
                ];
                const newRow = errorSheet.addRow(rowData);

                // Apply red background to all cells with errors
                if (rowErrors) {
                    rowErrors.forEach((_, colIndex) => {
                        const cell = newRow.getCell(colIndex);
                        cell.fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: "FFFF0000" },
                        };
                        cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
                    });
                }

                // Highlight the error details column in orange
                const errorCell = newRow.getCell(9);
                errorCell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFFF8C00" },
                };
                errorCell.font = { color: { argb: "FFFFFFFF" } };
            }

            // Auto-fit columns
            errorSheet.columns.forEach((column) => {
                let maxLength = 10;
                column.eachCell?.({ includeEmpty: true }, (cell) => {
                    const cellLength = String(cell.value || "").length;
                    if (cellLength > maxLength) {
                        maxLength = cellLength;
                    }
                });
                column.width = Math.min(maxLength + 2, 50);
            });

            const buffer = await errorWorkbook.xlsx.writeBuffer();
            errorFile = new Uint8Array(buffer as ArrayBuffer);

            // Collect error details for response
            cellErrors.forEach((colErrors, rNum) => {
                colErrors.forEach((errMsg, colIdx) => {
                    errors.push(`Row ${rNum}, ${colNames[colIdx]}: ${errMsg}`);
                });
            });
        }

        return {
            success,
            failed,
            successCount: success,
            failedCount: invalidRows.length,
            errors,
            errorFile,
        };
    },
};
