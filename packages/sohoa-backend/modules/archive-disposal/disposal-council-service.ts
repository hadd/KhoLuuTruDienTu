import { httpError } from "@shared/common-lib";
import { and, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";

import { db } from "../../db/db-conn.ts";
import { ArchiveStorageState } from "../../db/schemas/archive-storage-state-constants.ts";
import {
    DisposalCouncilEvaluationDecision,
    type DisposalCouncilEvaluationDecisionType,
    DisposalCouncilMemberHistoryAction,
    DisposalCouncilReviewResult,
    DisposalProposalCatalogStatus,
    DISPOSAL_SETTINGS_SINGLETON_ID,
} from "../../db/schemas/archive-disposal-constants.ts";
import {
    disposalProposalCatalogs,
    disposalProposalItems,
    disposalReviewCouncilItemEvaluationHistory,
    disposalReviewCouncilItemEvaluations,
    disposalReviewCouncilItemOutcomes,
    disposalReviewCouncilMemberHistory,
    disposalReviewCouncilMembers,
    disposalReviewCouncils,
    disposalSettings,
} from "../../db/schemas/archive-disposal.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import type { DisposalCatalogListScope } from "./archive-disposal-catalog-access.ts";
import { logActivity } from "../audit-log/audit-log-activity.ts";
import { scheduleDisposalCouncilAssignedNotification } from "../notification/notification-delivery-service.ts";

import {
    detectMemberHistoryAction,
    type CouncilMemberInput,
    toMemberSnapshots,
    validateCouncilMembers,
    validateMemberUpdateAfterReviewStarted,
} from "./disposal-council-validation.ts";
import { buildCouncilDecisionPdf } from "./disposal-council-decision-pdf.ts";
import {
    councilHasPendingChairDecisions,
    recomputeCouncilItemOutcomes,
} from "./disposal-council-outcomes.ts";
import {
    assertCouncilChairPosition,
    assertCouncilSecretaryPosition,
} from "./disposal-council-role-guards.ts";
import { resolveEvaluationUnitIds } from "./disposal-evaluation-units.ts";
import { buildLinkGet } from "../data-entry/data-entry-s3-utils.ts";
import { uploadSignedPdfToStorage } from "../digital-sign/digital-sign-s3-utils.ts";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";

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
        excusedAbsent: disposalReviewCouncilMembers.excusedAbsent,
        absentReason: disposalReviewCouncilMembers.absentReason,
        fullName: userProfiles.fullName,
        email: userProfiles.email,
    })
        .from(disposalReviewCouncilMembers)
        .innerJoin(userProfiles, eq(userProfiles.id, disposalReviewCouncilMembers.userId))
        .where(eq(disposalReviewCouncilMembers.councilId, councilId))
        .orderBy(disposalReviewCouncilMembers.sortOrder, disposalReviewCouncilMembers.createdAt);
}

async function isCouncilMember(councilId: string, userId: string): Promise<boolean> {
    const [row] = await db.select({ id: disposalReviewCouncilMembers.id })
        .from(disposalReviewCouncilMembers)
        .where(and(
            eq(disposalReviewCouncilMembers.councilId, councilId),
            eq(disposalReviewCouncilMembers.userId, userId),
        ))
        .limit(1);
    return Boolean(row);
}

async function assertPendingCouncilCatalog(councilId: string) {
    const detail = await DisposalCouncilService.getCouncil(councilId);
    if (detail.council.catalogStatus !== DisposalProposalCatalogStatus.PENDING_SUBMIT) {
        throw httpError.conflict("Danh mục không ở trạng thái Chờ thẩm tra");
    }
    if (detail.council.reviewResult) {
        throw httpError.conflict("Hội đồng đã có kết quả thẩm tra");
    }
    return detail;
}

function isCompleteCouncilEvaluation(
    decision: DisposalCouncilEvaluationDecisionType | null,
    note: string,
): boolean {
    return Boolean(decision) && note.trim().length > 0;
}

async function assertEvaluationsEditable(councilId: string) {
    const [council] = await db.select({
        decisionPublishedAt: disposalReviewCouncils.decisionPublishedAt,
    })
        .from(disposalReviewCouncils)
        .where(eq(disposalReviewCouncils.id, councilId))
        .limit(1);
    if (!council) throw httpError.notFound("Không tìm thấy Hội đồng xét hủy");
    if (council.decisionPublishedAt) {
        throw httpError.conflict("Đánh giá đã bị khóa sau khi xuất bản Quyết định");
    }
}

async function buildEvaluationProgress(councilId: string) {
    const members = await loadCouncilMembers(councilId);
    const participatingMembers = members.filter((member) => !member.excusedAbsent);
    const [council] = await db.select({
        catalogId: disposalReviewCouncils.catalogId,
        decisionPublishedAt: disposalReviewCouncils.decisionPublishedAt,
    })
        .from(disposalReviewCouncils)
        .where(eq(disposalReviewCouncils.id, councilId))
        .limit(1);
    if (!council) throw httpError.notFound("Không tìm thấy Hội đồng xét hủy");

    const items = await db.select({
        id: disposalProposalItems.id,
        dossierId: disposalProposalItems.dossierId,
        fileId: disposalProposalItems.fileId,
    })
        .from(disposalProposalItems)
        .where(eq(disposalProposalItems.catalogId, council.catalogId));

    const evaluationUnitIds = new Set(resolveEvaluationUnitIds(items));
    const unitCount = evaluationUnitIds.size;

    const evaluations = await db.select({
        userId: disposalReviewCouncilItemEvaluations.userId,
        itemId: disposalReviewCouncilItemEvaluations.itemId,
        decision: disposalReviewCouncilItemEvaluations.decision,
        note: disposalReviewCouncilItemEvaluations.note,
    })
        .from(disposalReviewCouncilItemEvaluations)
        .where(eq(disposalReviewCouncilItemEvaluations.councilId, councilId));

    const participatingUserIds = new Set(participatingMembers.map((m) => m.userId));
    const memberCount = members.length;
    const participatingMemberCount = participatingMembers.length;
    const itemCount = unitCount;
    const requiredCount = participatingMemberCount * itemCount;

    let submittedCount = 0;
    const submittedByMember = new Map<string, number>();
    for (const evaluation of evaluations) {
        if (!evaluationUnitIds.has(evaluation.itemId)) continue;
        if (!participatingUserIds.has(evaluation.userId)) continue;
        if (!isCompleteCouncilEvaluation(evaluation.decision, evaluation.note)) continue;
        submittedCount++;
        submittedByMember.set(
            evaluation.userId,
            (submittedByMember.get(evaluation.userId) ?? 0) + 1,
        );
    }

    const membersComplete = participatingMembers
        .filter((member) => (submittedByMember.get(member.userId) ?? 0) >= itemCount && itemCount > 0)
        .map((member) => member.userId);

    const missingMembers = participatingMembers
        .map((member) => {
            const done = submittedByMember.get(member.userId) ?? 0;
            const missingUnitCount = Math.max(0, itemCount - done);
            return {
                userId: member.userId,
                fullName: member.fullName,
                missingUnitCount,
            };
        })
        .filter((entry) => entry.missingUnitCount > 0);

    return {
        memberCount,
        participatingMemberCount,
        itemCount,
        requiredCount,
        submittedCount,
        membersComplete,
        missingMembers,
        evaluationsLocked: Boolean(council.decisionPublishedAt),
        isComplete: requiredCount > 0 && submittedCount >= requiredCount,
    };
}

function serializeCouncil(council: typeof disposalReviewCouncils.$inferSelect) {
    return {
        ...council,
        reviewStartedAt: council.reviewStartedAt?.toISOString() ?? null,
        decisionPublishedAt: council.decisionPublishedAt?.toISOString() ?? null,
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

    async listCouncils(
        _profile: UserWithRoles,
        query: { page?: number; limit?: number; catalogId?: string },
        scope: DisposalCatalogListScope,
    ) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const offset = (page - 1) * limit;

        const filters: SQL[] = [];
        if (query.catalogId) {
            filters.push(eq(disposalReviewCouncils.catalogId, query.catalogId));
        }
        if (scope.mode === "member_only") {
            filters.push(inArray(disposalReviewCouncils.catalogId, scope.catalogIds));
        }
        const whereClause = filters.length > 0 ? and(...filters) : undefined;

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
                .where(whereClause)
                .orderBy(desc(disposalReviewCouncils.createdAt))
                .limit(limit)
                .offset(offset),
            db.select({ count: sql<number>`count(*)::int` })
                .from(disposalReviewCouncils)
                .where(whereClause),
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

        const previousIds = new Set(previousSnapshots.map((member) => member.userId));
        const addedMemberIds = nextSnapshots
            .filter((member) => !previousIds.has(member.userId))
            .map((member) => member.userId);
        if (addedMemberIds.length > 0) {
            const [catalog] = await db.select({
                id: disposalProposalCatalogs.id,
                name: disposalProposalCatalogs.name,
            })
                .from(disposalProposalCatalogs)
                .where(eq(disposalProposalCatalogs.id, council.catalogId))
                .limit(1);
            if (catalog) {
                scheduleDisposalCouncilAssignedNotification({
                    councilId,
                    catalogId: catalog.id,
                    catalogName: catalog.name,
                    memberUserIds: addedMemberIds,
                });
            }
        }

        const detail = await this.getCouncil(councilId);
        return { ...detail, warnings };
    },

    async listCouncilEvaluations(councilId: string) {
        await this.getCouncil(councilId);

        const progress = await buildEvaluationProgress(councilId);
        const rows = await db.select({
            id: disposalReviewCouncilItemEvaluations.id,
            councilId: disposalReviewCouncilItemEvaluations.councilId,
            itemId: disposalReviewCouncilItemEvaluations.itemId,
            userId: disposalReviewCouncilItemEvaluations.userId,
            note: disposalReviewCouncilItemEvaluations.note,
            decision: disposalReviewCouncilItemEvaluations.decision,
            createdAt: disposalReviewCouncilItemEvaluations.createdAt,
            updatedAt: disposalReviewCouncilItemEvaluations.updatedAt,
            userName: userProfiles.fullName,
        })
            .from(disposalReviewCouncilItemEvaluations)
            .innerJoin(
                userProfiles,
                eq(userProfiles.id, disposalReviewCouncilItemEvaluations.userId),
            )
            .where(eq(disposalReviewCouncilItemEvaluations.councilId, councilId));

        const outcomeRows = await db.select({
            itemId: disposalReviewCouncilItemOutcomes.itemId,
            destroyVoteCount: disposalReviewCouncilItemOutcomes.destroyVoteCount,
            keepVoteCount: disposalReviewCouncilItemOutcomes.keepVoteCount,
            participatingMemberCount: disposalReviewCouncilItemOutcomes.participatingMemberCount,
            concludedDecision: disposalReviewCouncilItemOutcomes.concludedDecision,
            hasDissent: disposalReviewCouncilItemOutcomes.hasDissent,
            needsChairDecision: disposalReviewCouncilItemOutcomes.needsChairDecision,
            chairDecision: disposalReviewCouncilItemOutcomes.chairDecision,
            chairReason: disposalReviewCouncilItemOutcomes.chairReason,
            chairDecidedAt: disposalReviewCouncilItemOutcomes.chairDecidedAt,
        })
            .from(disposalReviewCouncilItemOutcomes)
            .where(eq(disposalReviewCouncilItemOutcomes.councilId, councilId));

        return {
            progress,
            items: rows.map((row) => ({
                id: row.id,
                councilId: row.councilId,
                itemId: row.itemId,
                userId: row.userId,
                userName: row.userName,
                note: row.note,
                decision: row.decision,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
            })),
            outcomes: outcomeRows.map((row) => ({
                itemId: row.itemId,
                destroyVoteCount: row.destroyVoteCount,
                keepVoteCount: row.keepVoteCount,
                participatingMemberCount: row.participatingMemberCount,
                concludedDecision: row.concludedDecision,
                hasDissent: row.hasDissent,
                needsChairDecision: row.needsChairDecision,
                chairDecision: row.chairDecision,
                chairReason: row.chairReason,
                chairDecidedAt: row.chairDecidedAt?.toISOString() ?? null,
            })),
        };
    },

    async upsertCouncilItemEvaluation(
        profile: UserWithRoles,
        councilId: string,
        itemId: string,
        input: {
            decision: DisposalCouncilEvaluationDecisionType;
            reason: string;
            changeReason?: string;
        },
    ) {
        const trimmedReason = input.reason.trim();
        if (!trimmedReason) {
            throw httpError.badRequest("Vui lòng nhập lý do đánh giá");
        }
        if (
            input.decision !== DisposalCouncilEvaluationDecision.DESTROY &&
            input.decision !== DisposalCouncilEvaluationDecision.KEEP
        ) {
            throw httpError.badRequest("Quyết định đánh giá không hợp lệ");
        }

        await assertPendingCouncilCatalog(councilId);
        await assertEvaluationsEditable(councilId);

        const isMember = await isCouncilMember(councilId, profile.id);
        if (!isMember) {
            throw httpError.forbidden("Chỉ thành viên Hội đồng mới được ghi ý kiến");
        }

        const [memberRow] = await db.select({
            excusedAbsent: disposalReviewCouncilMembers.excusedAbsent,
        })
            .from(disposalReviewCouncilMembers)
            .where(and(
                eq(disposalReviewCouncilMembers.councilId, councilId),
                eq(disposalReviewCouncilMembers.userId, profile.id),
            ))
            .limit(1);
        if (memberRow?.excusedAbsent) {
            throw httpError.conflict("Thành viên vắng mặt có lý do không được gửi đánh giá");
        }

        const [council] = await db.select({ catalogId: disposalReviewCouncils.catalogId })
            .from(disposalReviewCouncils)
            .where(eq(disposalReviewCouncils.id, councilId))
            .limit(1);
        if (!council) throw httpError.notFound("Không tìm thấy Hội đồng xét hủy");

        const [item] = await db.select({
            id: disposalProposalItems.id,
            dossierId: disposalProposalItems.dossierId,
            fileId: disposalProposalItems.fileId,
        })
            .from(disposalProposalItems)
            .where(and(
                eq(disposalProposalItems.id, itemId),
                eq(disposalProposalItems.catalogId, council.catalogId),
            ))
            .limit(1);
        if (!item) throw httpError.notFound("Không tìm thấy hồ sơ trong danh mục");

        const catalogItems = await db.select({
            id: disposalProposalItems.id,
            dossierId: disposalProposalItems.dossierId,
            fileId: disposalProposalItems.fileId,
        })
            .from(disposalProposalItems)
            .where(eq(disposalProposalItems.catalogId, council.catalogId));

        const evaluationUnitIds = new Set(resolveEvaluationUnitIds(catalogItems));
        if (!evaluationUnitIds.has(itemId)) {
            throw httpError.badRequest(
                "Chỉ được ghi ý kiến trên đơn vị đánh giá của hồ sơ hoặc tài liệu tương ứng trong danh mục",
            );
        }

        const now = new Date();
        const [existing] = await db.select({
            id: disposalReviewCouncilItemEvaluations.id,
            decision: disposalReviewCouncilItemEvaluations.decision,
            note: disposalReviewCouncilItemEvaluations.note,
        })
            .from(disposalReviewCouncilItemEvaluations)
            .where(and(
                eq(disposalReviewCouncilItemEvaluations.councilId, councilId),
                eq(disposalReviewCouncilItemEvaluations.itemId, itemId),
                eq(disposalReviewCouncilItemEvaluations.userId, profile.id),
            ))
            .limit(1);

        if (existing) {
            const changed = existing.decision !== input.decision ||
                existing.note.trim() !== trimmedReason;
            if (changed && !input.changeReason?.trim()) {
                throw httpError.badRequest("Vui lòng nhập lý do thay đổi đánh giá");
            }
            await db.update(disposalReviewCouncilItemEvaluations)
                .set({
                    decision: input.decision,
                    note: trimmedReason,
                    updatedAt: now,
                })
                .where(eq(disposalReviewCouncilItemEvaluations.id, existing.id));

            if (changed) {
                await db.insert(disposalReviewCouncilItemEvaluationHistory).values({
                    councilId,
                    itemId,
                    userId: profile.id,
                    oldDecision: existing.decision,
                    newDecision: input.decision,
                    oldNote: existing.note,
                    newNote: trimmedReason,
                    changeReason: input.changeReason?.trim() ?? "",
                    changedBy: profile.id,
                    createdAt: now,
                });
                logActivity({
                    userId: profile.id,
                    module: "archive-disposal",
                    eventType: "disposal.council.evaluation.updated",
                    summary: "Cập nhật phiếu đánh giá xét hủy",
                    entityType: "disposal_review_council",
                    entityId: councilId,
                });
            }
        } else {
            await db.insert(disposalReviewCouncilItemEvaluations).values({
                councilId,
                itemId,
                userId: profile.id,
                decision: input.decision,
                note: trimmedReason,
                createdAt: now,
                updatedAt: now,
            });
            await db.insert(disposalReviewCouncilItemEvaluationHistory).values({
                councilId,
                itemId,
                userId: profile.id,
                oldDecision: null,
                newDecision: input.decision,
                oldNote: null,
                newNote: trimmedReason,
                changeReason: null,
                changedBy: profile.id,
                createdAt: now,
            });
            logActivity({
                userId: profile.id,
                module: "archive-disposal",
                eventType: "disposal.council.evaluation.created",
                summary: "Gửi phiếu đánh giá xét hủy",
                entityType: "disposal_review_council",
                entityId: councilId,
            });
            await this.markCouncilReviewStarted(councilId);
        }

        await recomputeCouncilItemOutcomes(councilId);
        const progress = await buildEvaluationProgress(councilId);
        return { success: true, progress };
    },

    async finalizeCouncilReviewWithAuth(
        profile: UserWithRoles,
        councilId: string,
        result: typeof DisposalCouncilReviewResult[keyof typeof DisposalCouncilReviewResult],
    ) {
        await assertPendingCouncilCatalog(councilId);

        const progress = await buildEvaluationProgress(councilId);
        if (progress.itemCount === 0) {
            throw httpError.conflict("Danh mục không có hồ sơ để thẩm tra");
        }
        if (!progress.isComplete) {
            throw httpError.conflict(
                "Chưa đủ ý kiến đánh giá của tất cả thành viên cho mọi đơn vị đánh giá trong danh mục",
            );
        }

        await this.finalizeCouncilReview(councilId, result);

        const [council] = await db.select({
            code: disposalReviewCouncils.code,
            catalogId: disposalReviewCouncils.catalogId,
        })
            .from(disposalReviewCouncils)
            .where(eq(disposalReviewCouncils.id, councilId))
            .limit(1);

        const [catalog] = council
            ? await db.select({ name: disposalProposalCatalogs.name, status: disposalProposalCatalogs.status })
                .from(disposalProposalCatalogs)
                .where(eq(disposalProposalCatalogs.id, council.catalogId))
                .limit(1)
            : [];

        logActivity({
            userId: profile.id,
            module: "archive-disposal",
            eventType: "disposal.council.finalized",
            summary: `Kết luận Hội đồng ${council?.code ?? councilId}: ${result}`,
            entityType: "disposal_review_council",
            entityId: councilId,
            entityLabel: council?.code,
        });

        return {
            councilId,
            result,
            catalogStatus: catalog?.status ?? null,
        };
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

    async setCouncilMemberAbsent(
        profile: UserWithRoles,
        councilId: string,
        memberUserId: string,
        input: { excusedAbsent: boolean; absentReason?: string },
    ) {
        await assertPendingCouncilCatalog(councilId);
        await assertEvaluationsEditable(councilId);

        const reason = input.absentReason?.trim() ?? "";
        if (input.excusedAbsent && !reason) {
            throw httpError.badRequest("Vui lòng nhập lý do vắng mặt");
        }

        const [member] = await db.select({
            id: disposalReviewCouncilMembers.id,
        })
            .from(disposalReviewCouncilMembers)
            .where(and(
                eq(disposalReviewCouncilMembers.councilId, councilId),
                eq(disposalReviewCouncilMembers.userId, memberUserId),
            ))
            .limit(1);
        if (!member) throw httpError.notFound("Không tìm thấy thành viên Hội đồng");

        const now = new Date();
        await db.update(disposalReviewCouncilMembers)
            .set({
                excusedAbsent: input.excusedAbsent,
                absentReason: input.excusedAbsent ? reason : "",
                updatedAt: now,
            })
            .where(eq(disposalReviewCouncilMembers.id, member.id));

        await recomputeCouncilItemOutcomes(councilId);

        logActivity({
            userId: profile.id,
            module: "archive-disposal",
            eventType: "disposal.council.member.absent",
            summary: input.excusedAbsent
                ? "Đánh dấu thành viên vắng mặt có lý do"
                : "Hủy đánh dấu vắng mặt thành viên",
            entityType: "disposal_review_council",
            entityId: councilId,
        });

        const progress = await buildEvaluationProgress(councilId);
        return { success: true, progress };
    },

    async chairDecideCouncilItem(
        profile: UserWithRoles,
        councilId: string,
        itemId: string,
        input: {
            decision: DisposalCouncilEvaluationDecisionType;
            reason: string;
        },
    ) {
        const trimmedReason = input.reason.trim();
        if (!trimmedReason) {
            throw httpError.badRequest("Vui lòng nhập lý do quyết định của Chủ tịch");
        }

        await assertPendingCouncilCatalog(councilId);
        await assertEvaluationsEditable(councilId);
        await assertCouncilChairPosition(councilId, profile.id);

        const [outcome] = await db.select({
            id: disposalReviewCouncilItemOutcomes.id,
            needsChairDecision: disposalReviewCouncilItemOutcomes.needsChairDecision,
        })
            .from(disposalReviewCouncilItemOutcomes)
            .where(and(
                eq(disposalReviewCouncilItemOutcomes.councilId, councilId),
                eq(disposalReviewCouncilItemOutcomes.itemId, itemId),
            ))
            .limit(1);
        if (!outcome?.needsChairDecision) {
            throw httpError.conflict("Đơn vị đánh giá này không cần quyết định của Chủ tịch");
        }

        const now = new Date();
        await db.update(disposalReviewCouncilItemOutcomes)
            .set({
                chairDecision: input.decision,
                chairReason: trimmedReason,
                chairDecidedBy: profile.id,
                chairDecidedAt: now,
                concludedDecision: input.decision,
                needsChairDecision: false,
                updatedAt: now,
            })
            .where(eq(disposalReviewCouncilItemOutcomes.id, outcome.id));

        logActivity({
            userId: profile.id,
            module: "archive-disposal",
            eventType: "disposal.council.chair_decided",
            summary: "Chủ tịch quyết định khi hòa phiếu",
            entityType: "disposal_review_council",
            entityId: councilId,
        });

        const progress = await buildEvaluationProgress(councilId);
        return { success: true, progress };
    },

    async publishCouncilDecision(profile: UserWithRoles, councilId: string) {
        await assertPendingCouncilCatalog(councilId);
        await assertCouncilSecretaryPosition(councilId, profile.id);

        const detail = await this.getCouncil(councilId);
        if (detail.council.decisionPublishedAt) {
            throw httpError.conflict("Quyết định đã được xuất bản");
        }

        const progress = await buildEvaluationProgress(councilId);
        if (!progress.isComplete) {
            throw httpError.conflict(
                "Chưa đủ phiếu đánh giá của thành viên tham dự cho mọi đơn vị trong danh mục",
            );
        }
        if (await councilHasPendingChairDecisions(councilId)) {
            throw httpError.conflict("Còn đơn vị đánh giá chờ Chủ tịch quyết định khi hòa phiếu");
        }

        const outcomeRows = await db.select({
            itemId: disposalReviewCouncilItemOutcomes.itemId,
            concludedDecision: disposalReviewCouncilItemOutcomes.concludedDecision,
            hasDissent: disposalReviewCouncilItemOutcomes.hasDissent,
        })
            .from(disposalReviewCouncilItemOutcomes)
            .where(eq(disposalReviewCouncilItemOutcomes.councilId, councilId));

        const catalogItems = await db.select({
            id: disposalProposalItems.id,
            dossierId: disposalProposalItems.dossierId,
            fileId: disposalProposalItems.fileId,
            reason: disposalProposalItems.reason,
        })
            .from(disposalProposalItems)
            .where(eq(disposalProposalItems.catalogId, detail.council.catalogId));

        const dossierIds = [...new Set(catalogItems.map((i) => i.dossierId))];
        const dossierRows = dossierIds.length > 0
            ? await db.select({ id: dossiers.id, name: dossiers.name })
                .from(dossiers)
                .where(inArray(dossiers.id, dossierIds))
            : [];
        const dossierNameById = new Map(dossierRows.map((d) => [d.id, d.name]));

        const fileIds = catalogItems.map((i) => i.fileId).filter(Boolean) as string[];
        const fileRows = fileIds.length > 0
            ? await db.select({ id: dossierFiles.id, fileName: dossierFiles.fileName })
                .from(dossierFiles)
                .where(inArray(dossierFiles.id, fileIds))
            : [];
        const fileNameById = new Map(fileRows.map((f) => [f.id, f.fileName]));

        const outcomeByItem = new Map(outcomeRows.map((o) => [o.itemId, o]));
        const unitIds = resolveEvaluationUnitIds(catalogItems);
        const pdfRows = unitIds.map((unitId) => {
            const item = catalogItems.find((i) => i.id === unitId)!;
            const outcome = outcomeByItem.get(unitId);
            const dossierName = dossierNameById.get(item.dossierId) ?? item.dossierId;
            const label = item.fileId
                ? `${dossierName} / ${fileNameById.get(item.fileId) ?? item.fileId}`
                : dossierName;
            return {
                label,
                decision: outcome?.concludedDecision ?? null,
                hasDissent: outcome?.hasDissent ?? false,
            };
        });

        const publishedAt = new Date();
        const pdfBytes = await buildCouncilDecisionPdf({
            councilCode: detail.council.code,
            catalogName: detail.council.catalogName,
            catalogCode: detail.council.catalogCode,
            publishedAt,
            rows: pdfRows,
        });

        const storageKey = normalizeStorageKey(
            `archive-disposal/councils/${councilId}/decision-${publishedAt.toISOString().slice(0, 10)}.pdf`,
        );
        await uploadSignedPdfToStorage(storageKey, pdfBytes);

        await db.update(disposalReviewCouncils)
            .set({
                decisionPublishedAt: publishedAt,
                decisionDocumentStorageKey: storageKey,
                updatedAt: publishedAt,
            })
            .where(eq(disposalReviewCouncils.id, councilId));

        logActivity({
            userId: profile.id,
            module: "archive-disposal",
            eventType: "disposal.council.decision_published",
            summary: `Xuất bản Quyết định Hội đồng ${detail.council.code}`,
            entityType: "disposal_review_council",
            entityId: councilId,
            entityLabel: detail.council.code,
        });

        const documentUrl = await buildLinkGet(storageKey, { expirySeconds: 86_400 });
        return {
            councilId,
            decisionPublishedAt: publishedAt.toISOString(),
            documentUrl,
            evaluationsLocked: true,
        };
    },

    async uploadCouncilSignedMinutes(
        profile: UserWithRoles,
        councilId: string,
        file: File,
    ) {
        const detail = await this.getCouncil(councilId);
        if (!detail.council.decisionPublishedAt) {
            throw httpError.conflict("Cần xuất bản Quyết định trước khi tải biên bản ký");
        }

        const contentType = file.type || "application/pdf";
        if (contentType !== "application/pdf") {
            throw httpError.badRequest("Biên bản ký phải là file PDF");
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length === 0) {
            throw httpError.badRequest("File rỗng");
        }

        const storageKey = normalizeStorageKey(
            `archive-disposal/councils/${councilId}/signed-minutes.pdf`,
        );
        await uploadSignedPdfToStorage(storageKey, bytes);

        const now = new Date();
        await db.update(disposalReviewCouncils)
            .set({
                signedMinutesStorageKey: storageKey,
                updatedAt: now,
            })
            .where(eq(disposalReviewCouncils.id, councilId));

        logActivity({
            userId: profile.id,
            module: "archive-disposal",
            eventType: "disposal.council.signed_minutes_uploaded",
            summary: "Tải lên biên bản Hội đồng đã ký",
            entityType: "disposal_review_council",
            entityId: councilId,
        });

        const documentUrl = await buildLinkGet(storageKey, { expirySeconds: 86_400 });
        return {
            councilId,
            signedMinutesStorageKey: storageKey,
            documentUrl,
            hasSignedMinutes: true,
        };
    },

    async getCouncilDecisionDocuments(councilId: string) {
        const [council] = await db.select({
            decisionDocumentStorageKey: disposalReviewCouncils.decisionDocumentStorageKey,
            signedMinutesStorageKey: disposalReviewCouncils.signedMinutesStorageKey,
            decisionPublishedAt: disposalReviewCouncils.decisionPublishedAt,
        })
            .from(disposalReviewCouncils)
            .where(eq(disposalReviewCouncils.id, councilId))
            .limit(1);
        if (!council) throw httpError.notFound("Không tìm thấy Hội đồng xét hủy");

        const decisionUrl = council.decisionDocumentStorageKey
            ? await buildLinkGet(council.decisionDocumentStorageKey, { expirySeconds: 86_400 })
            : null;
        const signedMinutesUrl = council.signedMinutesStorageKey
            ? await buildLinkGet(council.signedMinutesStorageKey, { expirySeconds: 86_400 })
            : null;

        return {
            decisionPublishedAt: council.decisionPublishedAt?.toISOString() ?? null,
            decisionDocumentUrl: decisionUrl,
            signedMinutesDocumentUrl: signedMinutesUrl,
            hasSignedMinutes: Boolean(council.signedMinutesStorageKey),
        };
    },

    async getCouncilByCatalogId(catalogId: string) {
        const [council] = await db.select().from(disposalReviewCouncils)
            .where(eq(disposalReviewCouncils.catalogId, catalogId)).limit(1);
        if (!council) return null;
        return this.getCouncil(council.id);
    },
};
