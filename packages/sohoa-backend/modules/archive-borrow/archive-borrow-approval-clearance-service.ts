import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { archiveBorrowApprovalClearances } from "../../db/schemas/archive-borrow-approval-clearance.ts";
import { roles } from "../../db/schemas/role.ts";
import { securityLevels } from "../../db/schemas/security-level.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    hasPermissionInRules,
    parseRoleRules,
    userRolesHavePermission,
} from "../auth/permission-resolver.ts";
import { getLowestActiveLevel } from "../security-level/security-clearance.ts";

export type BorrowApprovalClearanceItem = {
    id: string;
    roleId: string;
    roleName: string;
    maxSecurityLevelId: string;
    maxSecurityLevelName: string;
    maxLevelOrder: number;
};

export type BorrowApprovalClearanceCatalog = {
    items: BorrowApprovalClearanceItem[];
    roles: Array<{ id: string; name: string }>;
    securityLevels: Array<{ id: string; name: string; levelOrder: number }>;
};

/** Max level_order the profile may approve; null = none; Infinity = admin bypass. */
export async function resolveBorrowApprovalClearance(
    profile: UserWithRoles,
): Promise<number | null> {
    if (userRolesHavePermission(profile.userRoles, "*")) {
        return Number.POSITIVE_INFINITY;
    }

    const roleIds = [
        ...new Set(
            profile.userRoles
                .map((ur) => ur.roleId)
                .filter((id): id is string => Boolean(id)),
        ),
    ];
    if (roleIds.length === 0) {
        return null;
    }

    const rows = await db
        .select({
            levelOrder: securityLevels.levelOrder,
        })
        .from(archiveBorrowApprovalClearances)
        .innerJoin(
            securityLevels,
            eq(
                archiveBorrowApprovalClearances.maxSecurityLevelId,
                securityLevels.id,
            ),
        )
        .where(
            and(
                inArray(archiveBorrowApprovalClearances.roleId, roleIds),
                isNull(archiveBorrowApprovalClearances.deletedAt),
                isNull(securityLevels.deletedAt),
                eq(securityLevels.isActive, true),
            ),
        );

    if (rows.length === 0) {
        return null;
    }

    return Math.max(...rows.map((r) => r.levelOrder));
}

export async function resolveRequestSecurityLevelOrder(
    securityLevelIds: Array<string | null | undefined>,
): Promise<number> {
    const lowest = await getLowestActiveLevel();
    const lowestOrder = lowest?.levelOrder ?? 0;
    const ids = [
        ...new Set(
            securityLevelIds.filter((id): id is string => typeof id === "string"),
        ),
    ];

    if (ids.length === 0) {
        return lowestOrder;
    }

    const levels = await db
        .select({
            id: securityLevels.id,
            levelOrder: securityLevels.levelOrder,
        })
        .from(securityLevels)
        .where(
            and(
                inArray(securityLevels.id, ids),
                isNull(securityLevels.deletedAt),
            ),
        );

    const orderById = new Map(levels.map((l) => [l.id, l.levelOrder]));
    let maxOrder = lowestOrder;
    for (const id of securityLevelIds) {
        if (!id) {
            maxOrder = Math.max(maxOrder, lowestOrder);
            continue;
        }
        maxOrder = Math.max(maxOrder, orderById.get(id) ?? lowestOrder);
    }
    return maxOrder;
}

export async function assertBorrowApprovalClearanceForLevels(
    profile: UserWithRoles,
    securityLevelIds: Array<string | null | undefined>,
): Promise<void> {
    const clearance = await resolveBorrowApprovalClearance(profile);
    if (clearance === null) {
        throw httpError.forbidden(
            "Chưa được cấu hình cấp duyệt mượn cho vai trò của bạn",
        );
    }
    if (clearance === Number.POSITIVE_INFINITY) {
        return;
    }
    const reqLevel = await resolveRequestSecurityLevelOrder(securityLevelIds);
    if (reqLevel > clearance) {
        throw httpError.forbidden(
            "Vượt cấp duyệt được cấu hình cho vai trò của bạn",
        );
    }
}

export async function loadSecurityLevelLabelMap(
    securityLevelIds: Array<string | null | undefined>,
): Promise<
    Map<string, { name: string; levelOrder: number }>
> {
    const ids = [
        ...new Set(
            securityLevelIds.filter((id): id is string => typeof id === "string"),
        ),
    ];
    if (ids.length === 0) {
        return new Map();
    }
    const rows = await db
        .select({
            id: securityLevels.id,
            name: securityLevels.name,
            levelOrder: securityLevels.levelOrder,
        })
        .from(securityLevels)
        .where(
            and(
                inArray(securityLevels.id, ids),
                isNull(securityLevels.deletedAt),
            ),
        );
    return new Map(
        rows.map((r) => [r.id, { name: r.name, levelOrder: r.levelOrder }]),
    );
}

export const ArchiveBorrowApprovalClearanceService = {
    async getCatalog(): Promise<BorrowApprovalClearanceCatalog> {
        const [items, roleRows, levelRows] = await Promise.all([
            db
                .select({
                    id: archiveBorrowApprovalClearances.id,
                    roleId: archiveBorrowApprovalClearances.roleId,
                    roleName: roles.name,
                    maxSecurityLevelId:
                        archiveBorrowApprovalClearances.maxSecurityLevelId,
                    maxSecurityLevelName: securityLevels.name,
                    maxLevelOrder: securityLevels.levelOrder,
                })
                .from(archiveBorrowApprovalClearances)
                .innerJoin(
                    roles,
                    eq(archiveBorrowApprovalClearances.roleId, roles.id),
                )
                .innerJoin(
                    securityLevels,
                    eq(
                        archiveBorrowApprovalClearances.maxSecurityLevelId,
                        securityLevels.id,
                    ),
                )
                .where(
                    and(
                        isNull(archiveBorrowApprovalClearances.deletedAt),
                        isNull(roles.deletedAt),
                        isNull(securityLevels.deletedAt),
                    ),
                )
                .orderBy(asc(roles.name)),
            db
                .select({ id: roles.id, name: roles.name, rules: roles.rules })
                .from(roles)
                .where(isNull(roles.deletedAt))
                .orderBy(asc(roles.name)),
            db
                .select({
                    id: securityLevels.id,
                    name: securityLevels.name,
                    levelOrder: securityLevels.levelOrder,
                })
                .from(securityLevels)
                .where(
                    and(
                        eq(securityLevels.isActive, true),
                        isNull(securityLevels.deletedAt),
                    ),
                )
                .orderBy(asc(securityLevels.levelOrder)),
        ]);

        const reviewRoles = roleRows
            .filter((role) =>
                hasPermissionInRules(
                    parseRoleRules(role.rules),
                    Permission.ARCHIVE_BORROW_REVIEW,
                )
            )
            .map(({ id, name }) => ({ id, name }));

        return {
            items,
            roles: reviewRoles,
            securityLevels: levelRows,
        };
    },

    async replaceAll(
        mappings: Array<{ roleId: string; maxSecurityLevelId: string }>,
    ): Promise<BorrowApprovalClearanceCatalog> {
        const roleIds = mappings.map((m) => m.roleId);
        if (new Set(roleIds).size !== roleIds.length) {
            throw httpError.badRequest("Mỗi vai trò chỉ được gán một cấp duyệt");
        }

        if (mappings.length > 0) {
            const existingRoles = await db
                .select({ id: roles.id, rules: roles.rules })
                .from(roles)
                .where(
                    and(inArray(roles.id, roleIds), isNull(roles.deletedAt)),
                );
            if (existingRoles.length !== roleIds.length) {
                throw httpError.badRequest("Vai trò không hợp lệ");
            }
            const invalidReviewRoles = existingRoles.filter(
                (role) =>
                    !hasPermissionInRules(
                        parseRoleRules(role.rules),
                        Permission.ARCHIVE_BORROW_REVIEW,
                    ),
            );
            if (invalidReviewRoles.length > 0) {
                throw httpError.badRequest(
                    "Chỉ được gán cấp duyệt cho vai trò có quyền Duyệt mượn tài liệu điện tử",
                );
            }

            const levelIds = [
                ...new Set(mappings.map((m) => m.maxSecurityLevelId)),
            ];
            const existingLevels = await db
                .select({ id: securityLevels.id })
                .from(securityLevels)
                .where(
                    and(
                        inArray(securityLevels.id, levelIds),
                        eq(securityLevels.isActive, true),
                        isNull(securityLevels.deletedAt),
                    ),
                );
            if (existingLevels.length !== levelIds.length) {
                throw httpError.badRequest(
                    "Cấp độ bảo mật không hợp lệ hoặc không hoạt động",
                );
            }
        }

        const now = new Date();
        await db.transaction(async (tx) => {
            await tx
                .update(archiveBorrowApprovalClearances)
                .set({ deletedAt: now, updatedAt: now })
                .where(isNull(archiveBorrowApprovalClearances.deletedAt));

            if (mappings.length > 0) {
                await tx.insert(archiveBorrowApprovalClearances).values(
                    mappings.map((m) => ({
                        roleId: m.roleId,
                        maxSecurityLevelId: m.maxSecurityLevelId,
                    })),
                );
            }
        });

        return await this.getCatalog();
    },

    async deleteByRoleId(roleId: string): Promise<void> {
        const now = new Date();
        const updated = await db
            .update(archiveBorrowApprovalClearances)
            .set({ deletedAt: now, updatedAt: now })
            .where(
                and(
                    eq(archiveBorrowApprovalClearances.roleId, roleId),
                    isNull(archiveBorrowApprovalClearances.deletedAt),
                ),
            )
            .returning({ id: archiveBorrowApprovalClearances.id });

        if (updated.length === 0) {
            throw httpError.notFound("Không tìm thấy cấu hình cấp duyệt cho vai trò này");
        }
    },
};
