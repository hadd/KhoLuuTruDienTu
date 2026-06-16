import { httpError } from "@shared/common-lib";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { groupMembers } from "../../db/schemas/group_members.ts";
import { groups } from "../../db/schemas/groups.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import {
    AssignmentStatus,
    DossierStatus,
    QC_CHECKER_WORKFLOW,
    WorkerRole,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";

const CHECKER_ROLES = QC_CHECKER_WORKFLOW.map((step) => step.role);

const GROUP_QC_ROLE_TO_WORKER: Record<string, WorkerRoleType> = {
    qc1: WorkerRole.CHECKER_1,
    qc2: WorkerRole.CHECKER_2,
    qc3: WorkerRole.CHECKER_3,
    qc4: WorkerRole.CHECKER_4,
    qc5: WorkerRole.CHECKER_5,
};

function calcRate(numerator: number, denominator: number): number {
    if (denominator === 0) {
        return 0;
    }
    return Math.round((numerator / denominator) * 10000) / 100;
}

function roundSeconds(value: number): number {
    return Math.round(value);
}

function startOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfWeek(): Date {
    const today = startOfToday();
    const day = today.getDay();
    const diff = day === 0 ? 6 : day - 1;
    return new Date(today.getTime() - diff * 24 * 60 * 60 * 1000);
}

async function getLeaderGroupId(userId: string): Promise<string> {
    const leaderMembership = await db.query.groupMembers.findFirst({
        where: and(
            eq(groupMembers.userId, userId),
            eq(groupMembers.role, "leader"),
            isNull(groupMembers.expiredAt),
        ),
        columns: { groupId: true },
    });

    if (!leaderMembership) {
        throw httpError.forbidden("Only group leader can view group dashboard statistics");
    }

    return leaderMembership.groupId;
}

async function aggregateEditorAssignmentStats(
    assigneeIds: string[],
    groupId?: string,
) {
    if (assigneeIds.length === 0) {
        return new Map<string, {
            completed: number;
            inProgress: number;
            correct: number;
            incorrect: number;
            avgProcessingTimeSeconds: number;
        }>();
    }

    const conditions = [
        inArray(dossierAssignments.assigneeId, assigneeIds),
        eq(dossierAssignments.role, WorkerRole.MAKER),
    ];

    if (groupId) {
        conditions.push(eq(dossiers.assignedGroupId, groupId));
    }

    const rows = await db
        .select({
            assigneeId: dossierAssignments.assigneeId,
            completed: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then 1 else 0 end), 0)`.mapWith(Number),
            inProgress: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.IN_PROGRESS} then 1 else 0 end), 0)`.mapWith(Number),
            correct: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossiers.status} = ${DossierStatus.APPROVED} and ${dossiers.rejectCount} = 0 and ${dossierAssignments.attemptNumber} = 1 then 1 else 0 end), 0)`.mapWith(Number),
            incorrect: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossiers.status} = ${DossierStatus.APPROVED} and (${dossiers.rejectCount} > 0 or ${dossierAssignments.attemptNumber} > 1) then 1 else 0 end), 0)`.mapWith(Number),
            avgProcessingTimeSeconds: sql<number>`coalesce(avg(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.completedAt} is not null then extract(epoch from (${dossierAssignments.completedAt} - ${dossierAssignments.assignedAt})) end), 0)`.mapWith(Number),
        })
        .from(dossierAssignments)
        .innerJoin(dossiers, eq(dossierAssignments.dossierId, dossiers.id))
        .where(activeDossierWhere(...conditions))
        .groupBy(dossierAssignments.assigneeId);

    return new Map(rows.map((row) => [row.assigneeId, row]));
}

async function aggregateQcAssignmentStats(
    assigneeIds: string[],
    workerRoles: WorkerRoleType[],
    groupId?: string,
) {
    if (assigneeIds.length === 0 || workerRoles.length === 0) {
        return new Map<string, {
            reviewed: number;
            approved: number;
        }>();
    }

    const conditions = [
        inArray(dossierAssignments.assigneeId, assigneeIds),
        inArray(dossierAssignments.role, workerRoles),
        inArray(dossierAssignments.status, [
            AssignmentStatus.COMPLETED,
            AssignmentStatus.REJECTED,
        ]),
    ];

    if (groupId) {
        conditions.push(eq(dossiers.assignedGroupId, groupId));
    }

    const rows = await db
        .select({
            assigneeId: dossierAssignments.assigneeId,
            reviewed: sql<number>`count(*)`.mapWith(Number),
            approved: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then 1 else 0 end), 0)`.mapWith(Number),
        })
        .from(dossierAssignments)
        .innerJoin(dossiers, eq(dossierAssignments.dossierId, dossiers.id))
        .where(activeDossierWhere(...conditions))
        .groupBy(dossierAssignments.assigneeId);

    return new Map(rows.map((row) => [row.assigneeId, row]));
}

export const DashboardService = {
    async getEditorStats(userId: string) {
        const [summary] = await db
            .select({
                totalAssigned: sql<number>`count(*)`.mapWith(Number),
                completed: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then 1 else 0 end), 0)`.mapWith(Number),
                inProgress: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.IN_PROGRESS} then 1 else 0 end), 0)`.mapWith(Number),
                correct: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossiers.status} = ${DossierStatus.APPROVED} and ${dossiers.rejectCount} = 0 and ${dossierAssignments.attemptNumber} = 1 then 1 else 0 end), 0)`.mapWith(Number),
                incorrect: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossiers.status} = ${DossierStatus.APPROVED} and (${dossiers.rejectCount} > 0 or ${dossierAssignments.attemptNumber} > 1) then 1 else 0 end), 0)`.mapWith(Number),
                avgProcessingTimeSeconds: sql<number>`coalesce(avg(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.completedAt} is not null then extract(epoch from (${dossierAssignments.completedAt} - ${dossierAssignments.assignedAt})) end), 0)`.mapWith(Number),
            })
            .from(dossierAssignments)
            .innerJoin(dossiers, eq(dossierAssignments.dossierId, dossiers.id))
            .where(activeDossierWhere(
                eq(dossierAssignments.assigneeId, userId),
                eq(dossierAssignments.role, WorkerRole.MAKER),
            ));

        const correct = summary?.correct ?? 0;
        const incorrect = summary?.incorrect ?? 0;
        const reviewedForAccuracy = correct + incorrect;

        return {
            totalAssigned: summary?.totalAssigned ?? 0,
            completed: summary?.completed ?? 0,
            inProgress: summary?.inProgress ?? 0,
            accuracy: {
                correct,
                incorrect,
                rate: calcRate(correct, reviewedForAccuracy),
            },
            avgProcessingTimeSeconds: roundSeconds(summary?.avgProcessingTimeSeconds ?? 0),
        };
    },

    async getQcStats(userId: string) {
        const [summary] = await db
            .select({
                totalAssigned: sql<number>`count(*)`.mapWith(Number),
                approved: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then 1 else 0 end), 0)`.mapWith(Number),
                rejected: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.REJECTED} then 1 else 0 end), 0)`.mapWith(Number),
                pending: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.IN_PROGRESS} then 1 else 0 end), 0)`.mapWith(Number),
            })
            .from(dossierAssignments)
            .where(and(
                eq(dossierAssignments.assigneeId, userId),
                inArray(dossierAssignments.role, CHECKER_ROLES),
            ));

        const approved = summary?.approved ?? 0;
        const rejected = summary?.rejected ?? 0;
        const reviewed = approved + rejected;

        const byStepRows = await db
            .select({
                step: dossierAssignments.stepNumber,
                role: dossierAssignments.role,
                approved: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then 1 else 0 end), 0)`.mapWith(Number),
                rejected: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.REJECTED} then 1 else 0 end), 0)`.mapWith(Number),
                pending: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.IN_PROGRESS} then 1 else 0 end), 0)`.mapWith(Number),
            })
            .from(dossierAssignments)
            .where(and(
                eq(dossierAssignments.assigneeId, userId),
                inArray(dossierAssignments.role, CHECKER_ROLES),
            ))
            .groupBy(dossierAssignments.stepNumber, dossierAssignments.role)
            .orderBy(dossierAssignments.stepNumber);

        return {
            totalAssigned: summary?.totalAssigned ?? 0,
            approved,
            rejected,
            reviewed,
            pending: summary?.pending ?? 0,
            efficiency: {
                approvalRate: calcRate(approved, reviewed),
                rejectionRate: calcRate(rejected, reviewed),
            },
            byStep: byStepRows.map((row) => ({
                step: row.step,
                role: row.role,
                approved: row.approved,
                rejected: row.rejected,
                pending: row.pending,
            })),
        };
    },

    async getQcGroupStats(userId: string) {
        const groupId = await getLeaderGroupId(userId);

        const group = await db.query.groups.findFirst({
            where: and(
                eq(groups.id, groupId),
                isNull(groups.deletedAt),
            ),
            columns: {
                id: true,
                name: true,
            },
        });

        if (!group) {
            throw httpError.notFound("Group not found");
        }

        const [dossierSummary] = await db
            .select({
                totalDossiers: sql<number>`count(*)`.mapWith(Number),
                approved: sql<number>`coalesce(sum(case when ${dossiers.status} = ${DossierStatus.APPROVED} then 1 else 0 end), 0)`.mapWith(Number),
                inProgress: sql<number>`coalesce(sum(case when ${dossiers.status} <> ${DossierStatus.APPROVED} then 1 else 0 end), 0)`.mapWith(Number),
            })
            .from(dossiers)
            .where(activeDossierWhere(
                eq(dossiers.assignedGroupId, groupId),
            ));

        const members = await db.query.groupMembers.findMany({
            where: and(
                eq(groupMembers.groupId, groupId),
                isNull(groupMembers.expiredAt),
            ),
            with: {
                userProfile: {
                    columns: {
                        id: true,
                        fullName: true,
                    },
                },
            },
        });

        const editorMembers = members.filter((member) => member.role === "editor");
        const qcMembers = members.filter((member) => member.role.startsWith("qc"));

        const editorStatsMap = await aggregateEditorAssignmentStats(
            editorMembers.map((member) => member.userId),
            groupId,
        );

        const qcStatsMap = await aggregateQcAssignmentStats(
            qcMembers.map((member) => member.userId),
            CHECKER_ROLES,
            groupId,
        );

        const totalDossiers = dossierSummary?.totalDossiers ?? 0;
        const approved = dossierSummary?.approved ?? 0;

        return {
            groupId: group.id,
            groupName: group.name,
            totalDossiers,
            approved,
            inProgress: dossierSummary?.inProgress ?? 0,
            progressRate: calcRate(approved, totalDossiers),
            editors: editorMembers.map((member) => {
                const stats = editorStatsMap.get(member.userId) ?? {
                    completed: 0,
                    inProgress: 0,
                    correct: 0,
                    incorrect: 0,
                    avgProcessingTimeSeconds: 0,
                };
                const reviewed = stats.correct + stats.incorrect;

                return {
                    userId: member.userId,
                    fullName: member.userProfile?.fullName ?? null,
                    completed: stats.completed,
                    inProgress: stats.inProgress,
                    correctRate: calcRate(stats.correct, reviewed),
                    avgProcessingTimeSeconds: roundSeconds(stats.avgProcessingTimeSeconds),
                };
            }),
            qcMembers: qcMembers.flatMap((member) => {
                const workerRole = GROUP_QC_ROLE_TO_WORKER[member.role];
                if (!workerRole) {
                    return [];
                }

                const stats = qcStatsMap.get(member.userId) ?? {
                    reviewed: 0,
                    approved: 0,
                };

                return [{
                    userId: member.userId,
                    fullName: member.userProfile?.fullName ?? null,
                    role: workerRole,
                    reviewed: stats.reviewed,
                    approved: stats.approved,
                    approvalRate: calcRate(stats.approved, stats.reviewed),
                }];
            }),
        };
    },

    async getAdminDashboard() {
        const todayStart = startOfToday();
        const weekStart = startOfWeek();

        const [
            statusRows,
            activeUsersRow,
            roleRows,
            groupsCountRow,
            qcPerformanceRow,
            makerPerformanceRow,
            approvedTodayRow,
            approvedWeekRow,
            activeGroups,
            recentActivityRows,
        ] = await Promise.all([
            db
                .select({
                    status: dossiers.status,
                    count: sql<number>`count(*)`.mapWith(Number),
                })
                .from(dossiers)
                .where(activeDossierWhere())
                .groupBy(dossiers.status),
            db
                .select({
                    count: sql<number>`count(*)`.mapWith(Number),
                })
                .from(userProfiles)
                .where(and(
                    eq(userProfiles.active, true),
                    isNull(userProfiles.deletedAt),
                )),
            db
                .select({
                    roleId: userRoles.roleId,
                    count: sql<number>`count(distinct ${userRoles.userId})`.mapWith(Number),
                })
                .from(userRoles)
                .innerJoin(userProfiles, eq(userRoles.userId, userProfiles.id))
                .where(and(
                    isNull(userRoles.expiredAt),
                    isNull(userProfiles.deletedAt),
                    eq(userProfiles.active, true),
                ))
                .groupBy(userRoles.roleId),
            db
                .select({
                    count: sql<number>`count(*)`.mapWith(Number),
                })
                .from(groups)
                .where(isNull(groups.deletedAt)),
            db
                .select({
                    approved: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then 1 else 0 end), 0)`.mapWith(Number),
                    rejected: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.REJECTED} then 1 else 0 end), 0)`.mapWith(Number),
                })
                .from(dossierAssignments)
                .where(inArray(dossierAssignments.role, CHECKER_ROLES)),
            db
                .select({
                    avgProcessingTimeSeconds: sql<number>`coalesce(avg(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.completedAt} is not null then extract(epoch from (${dossierAssignments.completedAt} - ${dossierAssignments.assignedAt})) end), 0)`.mapWith(Number),
                })
                .from(dossierAssignments)
                .where(eq(dossierAssignments.role, WorkerRole.MAKER)),
            db
                .select({
                    count: sql<number>`count(*)`.mapWith(Number),
                })
                .from(workflowLogs)
                .where(and(
                    eq(workflowLogs.toStatus, DossierStatus.APPROVED),
                    gte(workflowLogs.createdAt, todayStart),
                )),
            db
                .select({
                    count: sql<number>`count(*)`.mapWith(Number),
                })
                .from(workflowLogs)
                .where(and(
                    eq(workflowLogs.toStatus, DossierStatus.APPROVED),
                    gte(workflowLogs.createdAt, weekStart),
                )),
            db.query.groups.findMany({
                where: isNull(groups.deletedAt),
                columns: {
                    id: true,
                    name: true,
                },
            }),
            db
                .select({
                    dossierId: workflowLogs.dossierId,
                    dossierName: dossiers.name,
                    action: workflowLogs.action,
                    actorName: userProfiles.fullName,
                    createdAt: workflowLogs.createdAt,
                })
                .from(workflowLogs)
                .innerJoin(dossiers, eq(workflowLogs.dossierId, dossiers.id))
                .leftJoin(userProfiles, eq(workflowLogs.actorId, userProfiles.id))
                .where(activeDossierWhere())
                .orderBy(desc(workflowLogs.createdAt))
                .limit(10),
        ]);

        const byStatus: Record<string, number> = {};
        let totalDossiers = 0;
        for (const row of statusRows) {
            byStatus[row.status] = row.count;
            totalDossiers += row.count;
        }

        const byRole: Record<string, number> = {};
        for (const row of roleRows) {
            byRole[row.roleId] = row.count;
        }

        const qcApproved = qcPerformanceRow[0]?.approved ?? 0;
        const qcRejected = qcPerformanceRow[0]?.rejected ?? 0;
        const qcReviewed = qcApproved + qcRejected;

        const groupSummaries = await Promise.all(activeGroups.map(async (group) => {
            const [dossierSummary] = await db
                .select({
                    totalDossiers: sql<number>`count(*)`.mapWith(Number),
                    approved: sql<number>`coalesce(sum(case when ${dossiers.status} = ${DossierStatus.APPROVED} then 1 else 0 end), 0)`.mapWith(Number),
                })
                .from(dossiers)
                .where(activeDossierWhere(
                    eq(dossiers.assignedGroupId, group.id),
                ));

            const members = await db.query.groupMembers.findMany({
                where: and(
                    eq(groupMembers.groupId, group.id),
                    isNull(groupMembers.expiredAt),
                ),
                columns: {
                    userId: true,
                    role: true,
                },
            });

            const editorMembers = members.filter((member) => member.role === "editor");
            const qcMemberUserIds = members
                .filter((member) => member.role.startsWith("qc"))
                .map((member) => member.userId);

            const editorStatsMap = await aggregateEditorAssignmentStats(
                editorMembers.map((member) => member.userId),
                group.id,
            );
            const qcStatsMap = await aggregateQcAssignmentStats(
                qcMemberUserIds,
                CHECKER_ROLES,
                group.id,
            );

            const editorRates = editorMembers.map((member) => {
                const stats = editorStatsMap.get(member.userId);
                if (!stats) {
                    return 0;
                }
                return calcRate(stats.correct, stats.correct + stats.incorrect);
            });

            const qcRates = qcMemberUserIds.map((memberId) => {
                const stats = qcStatsMap.get(memberId);
                if (!stats) {
                    return 0;
                }
                return calcRate(stats.approved, stats.reviewed);
            });

            const avgEditorCorrectRate = editorRates.length > 0
                ? Math.round((editorRates.reduce((sum, rate) => sum + rate, 0) / editorRates.length) * 100) / 100
                : 0;
            const avgQcApprovalRate = qcRates.length > 0
                ? Math.round((qcRates.reduce((sum, rate) => sum + rate, 0) / qcRates.length) * 100) / 100
                : 0;

            const totalGroupDossiers = dossierSummary?.totalDossiers ?? 0;
            const approvedGroupDossiers = dossierSummary?.approved ?? 0;

            return {
                groupId: group.id,
                groupName: group.name,
                totalDossiers: totalGroupDossiers,
                approved: approvedGroupDossiers,
                progressRate: calcRate(approvedGroupDossiers, totalGroupDossiers),
                editorCount: editorMembers.length,
                avgEditorCorrectRate,
                avgQcApprovalRate,
            };
        }));

        return {
            overview: {
                totalDossiers,
                byStatus,
                totalActiveUsers: activeUsersRow[0]?.count ?? 0,
                byRole,
                totalGroups: groupsCountRow[0]?.count ?? 0,
            },
            performance: {
                overallApprovalRate: calcRate(qcApproved, qcReviewed),
                avgProcessingTimeSeconds: roundSeconds(
                    makerPerformanceRow[0]?.avgProcessingTimeSeconds ?? 0,
                ),
                dossiersApprovedToday: approvedTodayRow[0]?.count ?? 0,
                dossiersApprovedThisWeek: approvedWeekRow[0]?.count ?? 0,
            },
            groups: groupSummaries,
            recentActivity: recentActivityRows.map((row) => ({
                dossierId: row.dossierId,
                dossierName: row.dossierName,
                action: row.action,
                actorName: row.actorName,
                createdAt: row.createdAt,
            })),
        };
    },
};
