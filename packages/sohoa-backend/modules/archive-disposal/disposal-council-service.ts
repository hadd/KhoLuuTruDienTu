import { httpError } from "@shared/common-lib";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "../../db/db-conn.ts";
import { ArchiveStorageState } from "../../db/schemas/archive-storage-state-constants.ts";
import {
    DisposalCouncilMemberHistoryAction,
    DisposalCouncilReviewResult,
    DisposalProposalCatalogStatus,
    DISPOSAL_SETTINGS_SINGLETON_ID,
} from "../../db/schemas/archive-disposal-constants.ts";
import {
    disposalProposalCatalogs,
    disposalProposalItems,
    disposalReviewCouncilMemberHistory,
    disposalReviewCouncilMembers,
    disposalReviewCouncils,
    disposalSettings,
} from "../../db/schemas/archive-disposal.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { logActivity } from "../audit-log/audit-log-activity.ts";
import { scheduleDisposalCouncilAssignedNotification } from "../notification/notification-delivery-service.ts";

import {
    detectMemberHistoryAction,
    type CouncilMemberInput,
    toMemberSnapshots,
    validateCouncilMembers,
    validateMemberUpdateAfterReviewStarted,
} from "./disposal-council-validation.ts";

function generateCouncilCode(): string {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `HĐH-${stamp}-${suffix}`;
}

async function getSettingsRow() {
    const [row] = await db.select().from(disposalSettings)
        .where(eq(disposalSettings.id, DISPOSAL_SETTINGS_SINGLETON_ID))
        .limit(1);
    if (row) return row;

    const [inserted] = await db.insert(disposalSettings).values({
        id: DISPOSAL_SETTINGS_SINGLETON_ID,
        councilReviewEnabled: true,
    }).onConflictDoNothing().returning();

    if (inserted) return inserted;

    const [existing] = await db.select().from(disposalSettings)
        .where(eq(disposalSettings.id, DISPOSAL_SETTINGS_SINGLETON_ID))
        .limit(1);
    return existing!;
}

async function loadActiveUsers(userIds: string[]) {
    if (userIds.length === 0) return [];
    return db.select({
        id: userProfiles.id,
        fullName: userProfiles.fullName,
        email: userProfiles.email,
        active: userProfiles.active,
    }).from(userProfiles).where(and(
        inArray(userProfiles.id, userIds),
        isNull(userProfiles.deletedAt),
    ));
}

async function assertActiveUsers(userIds: string[]) {
    const users = await loadActiveUsers(userIds);
    const userMap = new Map(users.map((user) => [user.id, user]));
    const inactive = userIds.filter((userId) => {
        const user = userMap.get(userId);
        return !user || !user.active;
    });
    if (inactive.length > 0) {
        throw httpError.badRequest("Tài khoản thành viên không hợp lệ hoặc đã bị khóa");
    }
}

async function loadCouncilMembers(councilId: string) {
    return db.select({
        id: disposalReviewCouncilMembers.id,
        userId: disposalReviewCouncilMembers.userId,
        positionRole: disposalReviewCouncilMembers.positionRole,
        representationType: disposalReviewCouncilMembers.representationType,
        sortOrder: disposalReviewCouncilMembers.sortOrder,
        fullName: userProfiles.fullName,
        email: userProfiles.email,
    })
        .from(disposalReviewCouncilMembers)
        .innerJoin(userProfiles, eq(userProfiles.id, disposalReviewCouncilMembers.userId))
        .where(eq(disposalReviewCouncilMembers.councilId, councilId))
        .orderBy(disposalReviewCouncilMembers.sortOrder, disposalReviewCouncilMembers.createdAt);
}

function serializeCouncil(council: typeof disposalReviewCouncils.$inferSelect) {
    return {
        ...council,
        reviewStartedAt: council.reviewStartedAt?.toISOString() ?? null,
        createdAt: council.createdAt.toISOString(),
        updatedAt: council.updatedAt.toISOString(),
    };
}

async function detectConflictOfInterestWarnings(
    catalogId: string,
    memberUserIds: string[],
) {
    if (memberUserIds.length === 0) return [];

    const items = await db.select({ dossierId: disposalProposalItems.dossierId })
        .from(disposalProposalItems)
        .where(eq(disposalProposalItems.catalogId, catalogId));
    const dossierIds = [...new Set(items.map((item) => item.dossierId))];
    if (dossierIds.length === 0) return [];

    const assignments = await db.select({
        userId: dossierAssignments.assigneeId,
        dossierId: dossierAssignments.dossierId,
    })
        .from(dossierAssignments)
        .where(and(
            inArray(dossierAssignments.dossierId, dossierIds),
            inArray(dossierAssignments.assigneeId, memberUserIds),
        ));

    const memberSet = new Set(memberUserIds);
    return assignments
        .filter((assignment) => memberSet.has(assignment.userId))
        .map((assignment) => ({
            type: "CONFLICT_OF_INTEREST" as const,
            userId: assignment.userId,
            dossierId: assignment.dossierId,
            message: "Thành viên có thể liên quan đến hồ sơ trong danh mục (người chỉnh lý/phân công)",
        }));
}

export const DisposalCouncilService = {
    async getSettings() {
        const row = await getSettingsRow();
        return {
            councilReviewEnabled: row.councilReviewEnabled,
            updatedBy: row.updatedBy,
            updatedAt: row.updatedAt.toISOString(),
        };
    },

    async updateSettings(profile: UserWithRoles, councilReviewEnabled: boolean) {
        const now = new Date();
        const [updated] = await db.insert(disposalSettings).values({
            id: DISPOSAL_SETTINGS_SINGLETON_ID,
            councilReviewEnabled,
            updatedBy: profile.id,
            updatedAt: now,
        }).onConflictDoUpdate({
            target: disposalSettings.id,
            set: {
                councilReviewEnabled,
                updatedBy: profile.id,
                updatedAt: now,
            },
        }).returning();

        logActivity({
            userId: profile.id,
            module: "archive-disposal",
            eventType: "disposal.settings.updated",
            summary: `Cập nhật cấu hình Hội đồng xét hủy: ${councilReviewEnabled ? "bật" : "tắt"}`,
            entityType: "disposal_settings",
            entityId: DISPOSAL_SETTINGS_SINGLETON_ID,
        });

        return {
            councilReviewEnabled: updated!.councilReviewEnabled,
            updatedBy: updated!.updatedBy,
            updatedAt: updated!.updatedAt.toISOString(),
        };
    },

    async listCouncils(query: { page?: number; limit?: number; catalogId?: string }) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const offset = (page - 1) * limit;

        const filters = query.catalogId
            ? eq(disposalReviewCouncils.catalogId, query.catalogId)
            : undefined;

        const [rows, countRow] = await Promise.all([
            db.select({
                council: disposalReviewCouncils,
                catalogName: disposalProposalCatalogs.name,
                catalogCode: disposalProposalCatalogs.code,
                catalogStatus: disposalProposalCatalogs.status,
            })
                .from(disposalReviewCouncils)
                .innerJoin(
                    disposalProposalCatalogs,
                    eq(disposalProposalCatalogs.id, disposalReviewCouncils.catalogId),
                )
                .where(filters)
                .orderBy(desc(disposalReviewCouncils.createdAt))
                .limit(limit)
                .offset(offset),
            db.select({ count: sql<number>`count(*)::int` })
                .from(disposalReviewCouncils)
                .where(filters),
        ]);

        const total = countRow[0]?.count ?? 0;
        return {
            items: rows.map((row) => ({
                ...serializeCouncil(row.council),
                catalogName: row.catalogName,
                catalogCode: row.catalogCode,
                catalogStatus: row.catalogStatus,
            })),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    },

    async getCouncil(councilId: string) {
        const [row] = await db.select({
            council: disposalReviewCouncils,
            catalogName: disposalProposalCatalogs.name,
            catalogCode: disposalProposalCatalogs.code,
            catalogStatus: disposalProposalCatalogs.status,
        })
            .from(disposalReviewCouncils)
            .innerJoin(
                disposalProposalCatalogs,
                eq(disposalProposalCatalogs.id, disposalReviewCouncils.catalogId),
            )
            .where(eq(disposalReviewCouncils.id, councilId))
            .limit(1);

        if (!row) throw httpError.notFound("Không tìm thấy Hội đồng xét hủy");

        const members = await loadCouncilMembers(councilId);
        return {
            council: {
                ...serializeCouncil(row.council),
                catalogName: row.catalogName,
                catalogCode: row.catalogCode,
                catalogStatus: row.catalogStatus,
            },
            members,
        };
    },

    async getCouncilHistory(councilId: string) {
        const [council] = await db.select().from(disposalReviewCouncils)
            .where(eq(disposalReviewCouncils.id, councilId)).limit(1);
        if (!council) throw httpError.notFound("Không tìm thấy Hội đồng xét hủy");

        const rows = await db.select({
            id: disposalReviewCouncilMemberHistory.id,
            action: disposalReviewCouncilMemberHistory.action,
            reason: disposalReviewCouncilMemberHistory.reason,
            beforeSnapshot: disposalReviewCouncilMemberHistory.beforeSnapshot,
            afterSnapshot: disposalReviewCouncilMemberHistory.afterSnapshot,
            createdAt: disposalReviewCouncilMemberHistory.createdAt,
            changedBy: disposalReviewCouncilMemberHistory.changedBy,
            changedByName: userProfiles.fullName,
        })
            .from(disposalReviewCouncilMemberHistory)
            .innerJoin(
                userProfiles,
                eq(userProfiles.id, disposalReviewCouncilMemberHistory.changedBy),
            )
            .where(eq(disposalReviewCouncilMemberHistory.councilId, councilId))
            .orderBy(desc(disposalReviewCouncilMemberHistory.createdAt));

        return {
            items: rows.map((row) => ({
                id: row.id,
                action: row.action,
                reason: row.reason,
                beforeSnapshot: row.beforeSnapshot,
                afterSnapshot: row.afterSnapshot,
                createdAt: row.createdAt.toISOString(),
                changedBy: row.changedBy,
                changedByName: row.changedByName,
            })),
        };
    },

    async listAvailableCatalogsForCouncil() {
        const rows = await db.select({
            id: disposalProposalCatalogs.id,
            code: disposalProposalCatalogs.code,
            name: disposalProposalCatalogs.name,
            catalogDate: disposalProposalCatalogs.catalogDate,
            status: disposalProposalCatalogs.status,
        })
            .from(disposalProposalCatalogs)
            .leftJoin(
                disposalReviewCouncils,
                eq(disposalReviewCouncils.catalogId, disposalProposalCatalogs.id),
            )
            .where(and(
                eq(disposalProposalCatalogs.status, DisposalProposalCatalogStatus.SUBMITTED),
                isNull(disposalReviewCouncils.id),
            ))
            .orderBy(desc(disposalProposalCatalogs.updatedAt));

        return {
            items: rows.map((row) => ({
                ...row,
                catalogDate: row.catalogDate.toISOString().slice(0, 10),
            })),
        };
    },

    async createCouncil(
        profile: UserWithRoles,
        input: {
            catalogId: string;
            members: CouncilMemberInput[];
            copiedFromCouncilId?: string | null;
        },
    ) {
        const settings = await getSettingsRow();
        if (!settings.councilReviewEnabled) {
            throw httpError.conflict("Quy trình Hội đồng thẩm tra đang tắt");
        }

        const validationError = validateCouncilMembers(input.members);
        if (validationError) {
            throw httpError.badRequest(validationError.message);
        }

        await assertActiveUsers(input.members.map((member) => member.userId));

        const [catalog] = await db.select().from(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, input.catalogId)).limit(1);
        if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");
        if (catalog.status !== DisposalProposalCatalogStatus.SUBMITTED) {
            throw httpError.conflict("Danh mục chưa được trình hoặc không ở trạng thái Đã trình");
        }

        const [existingCouncil] = await db.select().from(disposalReviewCouncils)
            .where(eq(disposalReviewCouncils.catalogId, input.catalogId)).limit(1);
        if (existingCouncil) {
            throw httpError.conflict("Danh mục đã có Hội đồng phụ trách");
        }

        const warnings = await detectConflictOfInterestWarnings(
            input.catalogId,
            input.members.map((member) => member.userId),
        );

        const now = new Date();
        const memberSnapshots = toMemberSnapshots(input.members);

        const result = await db.transaction(async (tx) => {
            const [council] = await tx.insert(disposalReviewCouncils).values({
                code: generateCouncilCode(),
                catalogId: input.catalogId,
                copiedFromCouncilId: input.copiedFromCouncilId ?? null,
                createdBy: profile.id,
                createdAt: now,
                updatedAt: now,
            }).returning();

            await tx.insert(disposalReviewCouncilMembers).values(
                memberSnapshots.map((member) => ({
                    councilId: council!.id,
                    userId: member.userId,
                    positionRole: member.positionRole,
                    representationType: member.representationType,
                    sortOrder: member.sortOrder,
                })),
            );

            await tx.update(disposalProposalCatalogs)
                .set({
                    status: DisposalProposalCatalogStatus.PENDING_SUBMIT,
                    updatedAt: now,
                })
                .where(eq(disposalProposalCatalogs.id, input.catalogId));

            await tx.insert(disposalReviewCouncilMemberHistory).values({
                councilId: council!.id,
                action: DisposalCouncilMemberHistoryAction.CREATE,
                reason: "",
                changedBy: profile.id,
                beforeSnapshot: null,
                afterSnapshot: memberSnapshots,
            });

            return council!;
        });

        logActivity({
            userId: profile.id,
            module: "archive-disposal",
            eventType: "disposal.council.created",
            summary: `Tạo Hội đồng xét hủy ${result.code} cho danh mục ${catalog.name}`,
            entityType: "disposal_review_council",
            entityId: result.id,
            entityLabel: result.code,
        });

        scheduleDisposalCouncilAssignedNotification({
            councilId: result.id,
            catalogId: catalog.id,
            catalogName: catalog.name,
            memberUserIds: input.members.map((member) => member.userId),
        });

        const detail = await this.getCouncil(result.id);
        return { ...detail, warnings };
    },

    async copyCouncilMembers(
        profile: UserWithRoles,
        input: {
            targetCatalogId: string;
            sourceCouncilId: string;
            members?: CouncilMemberInput[];
        },
    ) {
        const source = await this.getCouncil(input.sourceCouncilId);
        const members = input.members ?? source.members.map((member) => ({
            userId: member.userId,
            positionRole: member.positionRole,
            representationType: member.representationType,
            sortOrder: member.sortOrder,
        }));

        return this.createCouncil(profile, {
            catalogId: input.targetCatalogId,
            members,
            copiedFromCouncilId: input.sourceCouncilId,
        });
    },

    async updateCouncilMembers(
        profile: UserWithRoles,
        councilId: string,
        input: {
            members: CouncilMemberInput[];
            reason?: string;
        },
    ) {
        const [council] = await db.select().from(disposalReviewCouncils)
            .where(eq(disposalReviewCouncils.id, councilId)).limit(1);
        if (!council) throw httpError.notFound("Không tìm thấy Hội đồng xét hủy");

        if (council.reviewResult) {
            throw httpError.conflict("Hội đồng đã có kết quả thẩm tra, không được chỉnh sửa thành viên");
        }

        const currentMembers = await loadCouncilMembers(councilId);
        const previousSnapshots = currentMembers.map((member) => ({
            userId: member.userId,
            positionRole: member.positionRole,
            representationType: member.representationType,
            sortOrder: member.sortOrder,
        }));

        if (council.reviewStartedAt) {
            const validationError = validateMemberUpdateAfterReviewStarted({
                previousMembers: previousSnapshots,
                nextMembers: input.members,
                reason: input.reason,
            });
            if (validationError) {
                throw httpError.badRequest(validationError.message);
            }
        } else {
            const validationError = validateCouncilMembers(input.members);
            if (validationError) {
                throw httpError.badRequest(validationError.message);
            }
        }

        await assertActiveUsers(input.members.map((member) => member.userId));

        const warnings = await detectConflictOfInterestWarnings(
            council.catalogId,
            input.members.map((member) => member.userId),
        );

        const nextSnapshots = toMemberSnapshots(input.members);
        const now = new Date();
        const historyAction = council.reviewStartedAt
            ? detectMemberHistoryAction(previousSnapshots, nextSnapshots)
            : DisposalCouncilMemberHistoryAction.UPDATE;

        await db.transaction(async (tx) => {
            await tx.delete(disposalReviewCouncilMembers)
                .where(eq(disposalReviewCouncilMembers.councilId, councilId));

            if (nextSnapshots.length > 0) {
                await tx.insert(disposalReviewCouncilMembers).values(
                    nextSnapshots.map((member) => ({
                        councilId,
                        userId: member.userId,
                        positionRole: member.positionRole,
                        representationType: member.representationType,
                        sortOrder: member.sortOrder,
                    })),
                );
            }

            await tx.update(disposalReviewCouncils)
                .set({ updatedAt: now })
                .where(eq(disposalReviewCouncils.id, councilId));

            await tx.insert(disposalReviewCouncilMemberHistory).values({
                councilId,
                action: historyAction,
                reason: input.reason?.trim() ?? "",
                changedBy: profile.id,
                beforeSnapshot: previousSnapshots,
                afterSnapshot: nextSnapshots,
            });
        });

        logActivity({
            userId: profile.id,
            module: "archive-disposal",
            eventType: "disposal.council.members.updated",
            summary: `Cập nhật thành viên Hội đồng ${council.code}`,
            entityType: "disposal_review_council",
            entityId: councilId,
            entityLabel: council.code,
        });

        const detail = await this.getCouncil(councilId);
        return { ...detail, warnings };
    },

    async markCouncilReviewStarted(councilId: string) {
        const now = new Date();
        const [updated] = await db.update(disposalReviewCouncils)
            .set({
                reviewStartedAt: now,
                updatedAt: now,
            })
            .where(and(
                eq(disposalReviewCouncils.id, councilId),
                isNull(disposalReviewCouncils.reviewStartedAt),
            ))
            .returning();
        return updated ?? null;
    },

    async finalizeCouncilReview(
        councilId: string,
        result: typeof DisposalCouncilReviewResult[keyof typeof DisposalCouncilReviewResult],
    ) {
        const [council] = await db.select().from(disposalReviewCouncils)
            .where(eq(disposalReviewCouncils.id, councilId)).limit(1);
        if (!council) throw httpError.notFound("Không tìm thấy Hội đồng xét hủy");

        const now = new Date();
        const catalogStatus = result === DisposalCouncilReviewResult.APPROVED
            ? DisposalProposalCatalogStatus.APPROVED
            : DisposalProposalCatalogStatus.REJECTED;

        await db.transaction(async (tx) => {
            await tx.update(disposalReviewCouncils)
                .set({
                    reviewResult: result,
                    reviewStartedAt: council.reviewStartedAt ?? now,
                    updatedAt: now,
                })
                .where(eq(disposalReviewCouncils.id, councilId));

            await tx.update(disposalProposalCatalogs)
                .set({
                    status: result === DisposalCouncilReviewResult.REJECTED
                        ? DisposalProposalCatalogStatus.DRAFT
                        : catalogStatus,
                    updatedAt: now,
                })
                .where(eq(disposalProposalCatalogs.id, council.catalogId));
        });
    },

    async executeDirectDestroy(profile: UserWithRoles, catalogId: string) {
        const settings = await getSettingsRow();
        if (settings.councilReviewEnabled) {
            throw httpError.conflict(
                "Quy trình Hội đồng thẩm tra đang bật — không thể hủy trực tiếp danh mục",
            );
        }

        const [catalog] = await db.select().from(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
        if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");
        if (catalog.status !== DisposalProposalCatalogStatus.SUBMITTED) {
            throw httpError.conflict("Chỉ được hủy trực tiếp danh mục ở trạng thái Đã trình");
        }

        const [existingCouncil] = await db.select().from(disposalReviewCouncils)
            .where(eq(disposalReviewCouncils.catalogId, catalogId)).limit(1);
        if (existingCouncil) {
            throw httpError.conflict("Danh mục đã có Hội đồng phụ trách");
        }

        const items = await db.select({
            dossierId: disposalProposalItems.dossierId,
        })
            .from(disposalProposalItems)
            .where(eq(disposalProposalItems.catalogId, catalogId));
        const dossierIds = [...new Set(items.map((item) => item.dossierId))];

        const now = new Date();
        await db.transaction(async (tx) => {
            await tx.update(disposalProposalCatalogs)
                .set({
                    status: DisposalProposalCatalogStatus.DESTROYED,
                    updatedAt: now,
                })
                .where(eq(disposalProposalCatalogs.id, catalogId));

            if (dossierIds.length > 0) {
                await tx.update(dossiers)
                    .set({ archiveStorageState: ArchiveStorageState.DESTROYED })
                    .where(inArray(dossiers.id, dossierIds));
            }
        });

        logActivity({
            userId: profile.id,
            module: "archive-disposal",
            eventType: "disposal.catalog.destroyed",
            summary: `Thực hiện hủy trực tiếp danh mục ${catalog.name}`,
            entityType: "disposal_proposal_catalog",
            entityId: catalogId,
            entityLabel: catalog.code,
        });

        const [updated] = await db.select().from(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
        return updated!;
    },

    async getCouncilByCatalogId(catalogId: string) {
        const [council] = await db.select().from(disposalReviewCouncils)
            .where(eq(disposalReviewCouncils.catalogId, catalogId)).limit(1);
        if (!council) return null;
        return this.getCouncil(council.id);
    },
};
