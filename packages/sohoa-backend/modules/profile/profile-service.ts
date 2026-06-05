import { createCrudService } from "@shared/base-crud";
import { db } from "../../db/db-conn.ts";
import {
    createUserProfileSchema,
    createUserProfileWithRoleSchema,
    patchUserStatusSchema,
    permanentDeleteUsersSchema,
    updateUserProfileSchema,
    updateUserProfileWithRoleSchema,
    type UserProfile,
    userProfiles,
} from "../../db/schemas/user_profile.ts";
import {
    authSessions,
    authSessionTokens,
    dossierAssignments,
    groupMembers,
    userRoles,
} from "../../db/schemas/index.ts";
import { roles } from "../../db/schemas/role.ts";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { cache } from "@shared/cache-lib";
import { httpError } from "@shared/common-lib";
import { hashPassword, verifyPassword } from "../../libs/helpers/password.ts";
import type { Static } from "elysia";
import ExcelJS from "exceljs";
import { excelCellToDateString, excelCellToString } from "../../libs/helpers/excel-cell.ts";
import {
    buildUserImportTemplateBuffer,
    isUserImportAllowedRole,
    isUserImportGuideRow,
    normalizeUserImportDate,
    normalizeUserImportPhone,
    resolveUserImportWorksheet,
    USER_IMPORT_ALLOWED_ROLES,
    USER_IMPORT_COLUMN_LABELS,
    USER_IMPORT_ERROR_SHEET_NAME,
    USER_IMPORT_ERROR_SHEET_TITLE,
    USER_EXPORT_HEADERS,
    USER_IMPORT_HEADERS,
} from "../../libs/user-import-template.ts";

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

        const fullName = profileData.fullName.trim();
        if (!fullName) {
            throw httpError.badRequest("fullName is required");
        }

        const passwordHash = await hashPassword(password);

        // Use provided roleId or default to "user"
        const roleId = inputRoleId || "editor";

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
                fullName,
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
        await db.update(userRoles)
            .set({ expiredAt: now })
            .where(and(eq(userRoles.userId, userId), activeRoleWhere));
        const result = await crud.delete(userId);
        await this.clearProfileCache(userId);
        return { id: result.id as string };
    },

    async permanentDeleteUsers(
        input: Static<typeof permanentDeleteUsersSchema>,
    ): Promise<{ deletedIds: string[]; notFoundIds: string[] }> {
        const uniqueIds = [...new Set(input.ids)];
        if (uniqueIds.length === 0) {
            throw httpError.badRequest("ids must not be empty");
        }

        const existingUsers = await db.query.userProfiles.findMany({
            where: inArray(userProfiles.id, uniqueIds),
            columns: { id: true },
        });
        const existingIdSet = new Set(existingUsers.map((user) => user.id));
        const deletedIds = uniqueIds.filter((id) => existingIdSet.has(id));
        const notFoundIds = uniqueIds.filter((id) => !existingIdSet.has(id));

        if (deletedIds.length === 0) {
            throw httpError.notFound("No users found for the provided ids");
        }

        await db.transaction(async (tx) => {
            await tx.delete(groupMembers).where(inArray(groupMembers.userId, deletedIds));
            await tx.delete(dossierAssignments).where(inArray(dossierAssignments.assigneeId, deletedIds));
            await tx.delete(userRoles).where(inArray(userRoles.userId, deletedIds));
            await tx.delete(userProfiles).where(inArray(userProfiles.id, deletedIds));
        });

        await Promise.all(deletedIds.map((id) => this.clearProfileCache(id)));

        return { deletedIds, notFoundIds };
    },

    async resetPassword(
        userId: string,
        currentPassword: string,
        newPassword: string,
    ): Promise<{ success: boolean; message: string }> {
        if (!userId || !currentPassword || !newPassword) {
            throw httpError.badRequest("userId, currentPassword and newPassword are required");
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

        if (!userProfile.passwordHash) {
            throw httpError.badRequest("User has no password set");
        }

        const isCurrentPasswordValid = await verifyPassword(currentPassword, userProfile.passwordHash);
        if (!isCurrentPasswordValid) {
            throw httpError.unauthorized("Current password is incorrect");
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
        const { roleId, password, ...profileData } = input;
        const passwordHash = password ? await hashPassword(password) : undefined;

        return await db.transaction(async (tx) => {
            // Update user profile using crud update but with tx
            const conditions = [eq(userProfiles.id, userId), isNull(userProfiles.deletedAt)];
            const [updatedProfile] = await tx
                .update(userProfiles)
                .set({
                    ...profileData,
                    ...(passwordHash ? { passwordHash } : {}),
                    updatedAt: new Date(),
                })
                .where(and(...conditions))
                .returning();

            if (!updatedProfile) {
                throw httpError.notFound("User not found");
            }

            if (passwordHash) {
                const now = new Date();
                await tx.update(authSessions).set({ revokedAt: now }).where(
                    and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)),
                );
                await tx.update(authSessionTokens).set({ revokedAt: now }).where(
                    and(eq(authSessionTokens.userId, userId), isNull(authSessionTokens.revokedAt)),
                );
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

    async getUsersByRole(roleId: string) {
        if (!roleId) {
            throw httpError.badRequest("roleId is required");
        }

        const existingRole = await db.query.roles.findFirst({
            where: and(eq(roles.id, roleId), isNull(roles.deletedAt)),
        });
        if (!existingRole) {
            throw httpError.notFound(`Role "${roleId}" not found`);
        }

        const assignments = await db.query.userRoles.findMany({
            where: and(eq(userRoles.roleId, roleId), activeRoleWhere),
            with: {
                userProfile: true,
                role: true,
            },
        });

        const items = assignments
            .map((assignment) => {
                const profile = assignment.userProfile;
                if (!profile || profile.deletedAt || !profile.active) {
                    return null;
                }
                return stripProfileSecrets({
                    ...profile,
                    userRoles: [{
                        id: assignment.id,
                        userId: assignment.userId,
                        roleId: assignment.roleId,
                        createdAt: assignment.createdAt,
                        expiredAt: assignment.expiredAt,
                        role: assignment.role,
                    }],
                });
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

        return { items, total: items.length };
    },

    async downloadTemplateExcel(): Promise<Uint8Array> {
        return await buildUserImportTemplateBuffer();
    },

    async exportUsersExcel() {
        const result = await this.getAllActiveUsers();
        const users = result.items || [];

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Users");

        worksheet.addRow([...USER_EXPORT_HEADERS]);

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
        const worksheet = resolveUserImportWorksheet(workbook);
        if (!worksheet) {
            return {
                success: 0,
                failed: 0,
                successCount: 0,
                failedCount: 0,
                errors: ["Không tìm thấy sheet dữ liệu (Import) trong file Excel"],
            };
        }

        const rows: ParsedRow[] = [];
        const col = USER_IMPORT_COLUMNS;
        const colLabels = USER_IMPORT_COLUMN_LABELS;

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const parsedRow: ParsedRow = {
                rowNumber,
                email: excelCellToString(row.getCell(col.EMAIL)),
                password: excelCellToString(row.getCell(col.PASSWORD)),
                fullName: excelCellToString(row.getCell(col.FULL_NAME)),
                phone: excelCellToString(row.getCell(col.PHONE)),
                address: excelCellToString(row.getCell(col.ADDRESS)),
                role: excelCellToString(row.getCell(col.ROLE)),
                gender: excelCellToString(row.getCell(col.GENDER)),
                dateOfBirth: excelCellToDateString(row.getCell(col.DATE_OF_BIRTH)),
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
            if (isUserImportGuideRow(parsedRow)) return;

            rows.push(parsedRow);
        });

        // Phase 1: Validate all rows synchronously (without DB check)
        const cellErrors: Map<number, Map<number, string>> = new Map();
        const emailErrors: Map<string, number> = new Map();

        for (const row of rows) {
            const rowErrors = new Map<number, string>();

            const emailVal = row.email.trim();
            if (!emailVal) {
                rowErrors.set(col.EMAIL, "Email là bắt buộc");
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
                rowErrors.set(col.EMAIL, "Định dạng email không hợp lệ");
            } else if (emailErrors.has(emailVal.toLowerCase())) {
                rowErrors.set(
                    col.EMAIL,
                    `Email trùng với dòng ${emailErrors.get(emailVal.toLowerCase())!} trong file`,
                );
            } else {
                emailErrors.set(emailVal.toLowerCase(), row.rowNumber);
            }

            const fullNameVal = row.fullName.trim();
            if (!fullNameVal) {
                rowErrors.set(col.FULL_NAME, "Họ và tên là bắt buộc");
            } else {
                row.fullName = fullNameVal;
            }

            const rawPhone = row.phone.trim();
            if (rawPhone) {
                const phoneResult = normalizeUserImportPhone(rawPhone);
                if (!phoneResult.ok) {
                    rowErrors.set(
                        col.PHONE,
                        "Số điện thoại không hợp lệ (10 số bắt đầu 0, hoặc 9 số nếu Excel đã bỏ số 0 đầu)",
                    );
                } else {
                    row.phone = phoneResult.phone;
                }
            }

            const genderVal = row.gender.trim();
            if (genderVal) {
                const validGenders = ["male", "female", "other", "unspecified"];
                if (!validGenders.includes(genderVal.toLowerCase())) {
                    rowErrors.set(
                        col.GENDER,
                        `Giới tính "${genderVal}" không hợp lệ. Chỉ được: male, female, other, unspecified`,
                    );
                }
            }

            const dobVal = row.dateOfBirth.trim();
            if (dobVal) {
                const dobResult = normalizeUserImportDate(dobVal);
                if (!dobResult.ok) {
                    rowErrors.set(
                        col.DATE_OF_BIRTH,
                        "Ngày sinh không hợp lệ (YYYY-MM-DD hoặc DD/MM/YYYY)",
                    );
                } else {
                    row.dateOfBirth = dobResult.date;
                }
            }

            const roleVal = row.role.trim();
            if (roleVal && !isUserImportAllowedRole(roleVal)) {
                rowErrors.set(
                    col.ROLE,
                    `Vai trò "${roleVal}" không hợp lệ. Chỉ được chọn: ${USER_IMPORT_ALLOWED_ROLES.join(", ")}`,
                );
            }

            const passwordVal = row.password.trim();
            if (!passwordVal) {
                rowErrors.set(col.PASSWORD, "Mật khẩu là bắt buộc");
            } else if (passwordVal.length < 8) {
                rowErrors.set(col.PASSWORD, "Mật khẩu phải có ít nhất 8 ký tự");
            }

            if (rowErrors.size > 0) {
                cellErrors.set(row.rowNumber, rowErrors);
            }
        }

        // Phase 2: Validate roles exist in DB (allowed set checked in phase 1)
        for (const row of rows) {
            const roleVal = row.role.trim().toLowerCase();
            if (!roleVal) continue;

            const rowErrMap = cellErrors.get(row.rowNumber);
            if (rowErrMap?.has(col.ROLE)) continue;

            const existingRole = await db.query.roles.findFirst({
                where: eq(roles.id, roleVal),
            });
            if (!existingRole) {
                const errors = rowErrMap || new Map<number, string>();
                errors.set(col.ROLE, `Vai trò "${roleVal}" không tồn tại trong hệ thống`);
                cellErrors.set(row.rowNumber, errors);
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
                rowErr.set(col.EMAIL, `Email "${emailVal}" đã tồn tại trong hệ thống`);
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
                let roleId: string = "editor";
                const roleVal = row.role.trim().toLowerCase();
                if (roleVal && isUserImportAllowedRole(roleVal)) {
                    roleId = roleVal;
                }

                await db.transaction(async (tx) => {
                    const [newUser] = await tx.insert(userProfiles).values({
                        email: row.email,
                        fullName: row.fullName,
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
                errors.push(
                    `Dòng ${row.rowNumber}: ${err instanceof Error ? err.message : "Lỗi không xác định"}`,
                );
                failed++;
            }
        }

        // Phase 5: Create error Excel file ONLY with failed rows (red highlighted)
        let errorFile: Uint8Array | undefined;
        if (invalidRows.length > 0) {
            const errorWorkbook = new ExcelJS.Workbook();
            const errorSheet = errorWorkbook.addWorksheet(USER_IMPORT_ERROR_SHEET_NAME);

            // Add title row
            errorSheet.addRow([USER_IMPORT_ERROR_SHEET_TITLE]);
            errorSheet.mergeCells(1, 1, 1, USER_IMPORT_HEADERS.length);
            errorSheet.getRow(1).getCell(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
            errorSheet.getRow(1).getCell(1).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFCC0000" },
            };
            errorSheet.getRow(1).getCell(1).alignment = { horizontal: "center" };

            // Add summary
            errorSheet.addRow([]);
            errorSheet.addRow(["Tổng số dòng", rows.length.toString()]);
            errorSheet.addRow(["Thành công", success.toString()]);
            errorSheet.addRow(["Thất bại", invalidRows.length.toString()]);
            errorSheet.addRow([]);

            // Add headers (same columns as import template; errors in cell notes on hover)
            const headerRow = errorSheet.addRow([...USER_IMPORT_HEADERS]);
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

            // Add invalid rows: red fill on error cells; error text in note (hover to read)
            for (const parsedRow of invalidRows) {
                const rowErrors = cellErrors.get(parsedRow.rowNumber);

                const newRow = errorSheet.addRow([
                    parsedRow.email || "",
                    parsedRow.password || "",
                    parsedRow.fullName || "",
                    parsedRow.phone || "",
                    parsedRow.address || "",
                    parsedRow.role || "",
                    parsedRow.gender || "",
                    parsedRow.dateOfBirth || "",
                ]);

                if (rowErrors) {
                    rowErrors.forEach((errMsg, colIndex) => {
                        const cell = newRow.getCell(colIndex);
                        cell.note = errMsg;
                        cell.fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: "FFFF0000" },
                        };
                        cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
                    });
                }
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
                    errors.push(`Dòng ${rNum}, ${colLabels[colIdx]}: ${errMsg}`);
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
