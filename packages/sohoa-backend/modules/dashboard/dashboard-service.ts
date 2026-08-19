import { httpError } from "@shared/common-lib";
// Bổ sung: desc, isNotNull, lte
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";

// Import các schemas bị thiếu
import { archiveBorrowRequests } from "../../db/schemas/archive-borrow.ts";
import { fonds } from "../../db/schemas/fond.ts";

import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { groupMembers } from "../../db/schemas/group_members.ts";
import { groups } from "../../db/schemas/groups.ts";
import { ProjectStatus } from "../../db/schemas/project-constants.ts";
import { projects } from "../../db/schemas/project.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import {
    AssignmentStatus,
    DossierStatus,
    QC_CHECKER_WORKFLOW,
    WorkerRole,
    WorkQuality,
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

type ChartGranularity = "day" | "month" | "year";

const CHART_RANGE_LENGTH: Record<ChartGranularity, number> = {
    day: 30,
    month: 12,
    year: 5,
};

function startOfChartRange(granularity: ChartGranularity): Date {
    const now = startOfToday();
    if (granularity === "day") {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (CHART_RANGE_LENGTH.day - 1));
    }
    if (granularity === "month") {
        return new Date(now.getFullYear(), now.getMonth() - (CHART_RANGE_LENGTH.month - 1), 1);
    }
    return new Date(now.getFullYear() - (CHART_RANGE_LENGTH.year - 1), 0, 1);
}

function formatChartPeriod(date: Date, granularity: ChartGranularity): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    if (granularity === "year") {
        return String(year);
    }
    if (granularity === "month") {
        return `${year}-${month}`;
    }
    return `${year}-${month}-${day}`;
}

function advanceChartPeriod(date: Date, granularity: ChartGranularity): Date {
    if (granularity === "year") {
        return new Date(date.getFullYear() + 1, 0, 1);
    }
    if (granularity === "month") {
        return new Date(date.getFullYear(), date.getMonth() + 1, 1);
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function buildChartPeriodKeys(rangeStart: Date, rangeEnd: Date, granularity: ChartGranularity): string[] {
    const keys: string[] = [];
    let cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
        keys.push(formatChartPeriod(cursor, granularity));
        cursor = advanceChartPeriod(cursor, granularity);
    }
    return keys;
}

function mapSqlPeriodToChartKey(value: Date | string, granularity: ChartGranularity): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    return formatChartPeriod(date, granularity);
}

function scopedDossierCondition(projectCodes?: string[]) {
    if (!projectCodes) {
        return activeDossierWhere();
    }
    if (projectCodes.length === 0) {
        return activeDossierWhere(sql`false`);
    }
    return activeDossierWhere(inArray(dossiers.projectCode, projectCodes));
}

async function aggregateDossierChart(
    granularity: ChartGranularity,
    projectCodes?: string[],
) {
    const rangeStart = startOfChartRange(granularity);
    const rangeEnd = startOfToday();

    const periodBucket = granularity === "day"
        ? sql`date_trunc('day', ${workflowLogs.createdAt})`
        : granularity === "month"
            ? sql`date_trunc('month', ${workflowLogs.createdAt})`
            : sql`date_trunc('year', ${workflowLogs.createdAt})`;

    const rows = await db
        .select({
            period: sql<Date>`${periodBucket}`,
            editedCompleted: sql<number>`count(distinct case when ${workflowLogs.action} = 'SUBMIT_ENTRY' then ${workflowLogs.dossierId} end)`.mapWith(Number),
            fullyCompleted: sql<number>`count(distinct case when ${workflowLogs.toStatus} = ${DossierStatus.APPROVED} then ${workflowLogs.dossierId} end)`.mapWith(Number),
        })
        .from(workflowLogs)
        .innerJoin(dossiers, eq(workflowLogs.dossierId, dossiers.id))
        .where(and(
            scopedDossierCondition(projectCodes),
            gte(workflowLogs.createdAt, rangeStart),
        ))
        .groupBy(periodBucket)
        .orderBy(periodBucket);

    const countsByPeriod = new Map<string, { editedCompleted: number; fullyCompleted: number }>();
    for (const row of rows) {
        const key = mapSqlPeriodToChartKey(row.period, granularity);
        countsByPeriod.set(key, {
            editedCompleted: row.editedCompleted,
            fullyCompleted: row.fullyCompleted,
        });
    }

    const points = buildChartPeriodKeys(rangeStart, rangeEnd, granularity).map((period) => {
        const counts = countsByPeriod.get(period);
        return {
            period,
            editedCompleted: counts?.editedCompleted ?? 0,
            fullyCompleted: counts?.fullyCompleted ?? 0,
        };
    });

    return {
        granularity,
        rangeStart,
        rangeEnd,
        points,
    };
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
            correct: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.workQuality} = ${WorkQuality.CORRECT} then 1 else 0 end), 0)`.mapWith(Number),
            incorrect: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.workQuality} = ${WorkQuality.INCORRECT} then 1 else 0 end), 0)`.mapWith(Number),
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
                correct: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.workQuality} = ${WorkQuality.CORRECT} then 1 else 0 end), 0)`.mapWith(Number),
                incorrect: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.workQuality} = ${WorkQuality.INCORRECT} then 1 else 0 end), 0)`.mapWith(Number),
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

    async getAdminDashboard(
        chartGranularity: ChartGranularity = "month",
        options?: { projectCodes?: string[] },
    ) {
        const projectCodes = options?.projectCodes;
        const isScoped = projectCodes !== undefined;
        const todayStart = startOfToday();
        const weekStart = startOfWeek();

        const dossierScope = scopedDossierCondition(projectCodes);
        const groupConditions = [isNull(groups.deletedAt)];
        if (projectCodes) {
            if (projectCodes.length === 0) {
                groupConditions.push(sql`false`);
            } else {
                groupConditions.push(inArray(groups.projectCode, projectCodes));
            }
        }

        const projectConditions = [isNull(projects.deletedAt)];
        if (projectCodes) {
            if (projectCodes.length === 0) {
                projectConditions.push(sql`false`);
            } else {
                projectConditions.push(inArray(projects.projectCode, projectCodes));
            }
        }

        const [
            statusRows,
            activeUsersRow,
            roleRows,
            groupsCountRow,
            qcPerformanceRow,
            makerPerformanceRow,
            makerAccuracyRow,
            projectStatusRows,
            approvedTodayRow,
            approvedWeekRow,
            activeGroups,
            dossierChart,
        ] = await Promise.all([
            db
                .select({
                    status: dossiers.status,
                    count: sql<number>`count(*)`.mapWith(Number),
                })
                .from(dossiers)
                .where(dossierScope)
                .groupBy(dossiers.status),
            isScoped
                ? Promise.resolve([{ count: 0 }])
                : db
                    .select({
                        count: sql<number>`count(*)`.mapWith(Number),
                    })
                    .from(userProfiles)
                    .where(and(
                        eq(userProfiles.active, true),
                        isNull(userProfiles.deletedAt),
                    )),
            isScoped
                ? Promise.resolve([])
                : db
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
                .where(and(...groupConditions)),
            db
                .select({
                    approved: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then 1 else 0 end), 0)`.mapWith(Number),
                    rejected: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.REJECTED} then 1 else 0 end), 0)`.mapWith(Number),
                })
                .from(dossierAssignments)
                .innerJoin(dossiers, eq(dossierAssignments.dossierId, dossiers.id))
                .where(and(
                    inArray(dossierAssignments.role, CHECKER_ROLES),
                    projectCodes
                        ? (projectCodes.length === 0
                            ? sql`false`
                            : inArray(dossiers.projectCode, projectCodes))
                        : undefined,
                )),
            db
                .select({
                    avgProcessingTimeSeconds: sql<number>`coalesce(avg(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.completedAt} is not null then extract(epoch from (${dossierAssignments.completedAt} - ${dossierAssignments.assignedAt})) end), 0)`.mapWith(Number),
                })
                .from(dossierAssignments)
                .innerJoin(dossiers, eq(dossierAssignments.dossierId, dossiers.id))
                .where(activeDossierWhere(
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    projectCodes
                        ? (projectCodes.length === 0
                            ? sql`false`
                            : inArray(dossiers.projectCode, projectCodes))
                        : undefined,
                )),
            db
                .select({
                    correct: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.workQuality} = ${WorkQuality.CORRECT} then 1 else 0 end), 0)`.mapWith(Number),
                    incorrect: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.workQuality} = ${WorkQuality.INCORRECT} then 1 else 0 end), 0)`.mapWith(Number),
                })
                .from(dossierAssignments)
                .innerJoin(dossiers, eq(dossierAssignments.dossierId, dossiers.id))
                .where(activeDossierWhere(
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    projectCodes
                        ? (projectCodes.length === 0
                            ? sql`false`
                            : inArray(dossiers.projectCode, projectCodes))
                        : undefined,
                )),
            db
                .select({
                    status: projects.status,
                    count: sql<number>`count(*)`.mapWith(Number),
                })
                .from(projects)
                .where(and(...projectConditions))
                .groupBy(projects.status),
            db
                .select({
                    count: sql<number>`count(*)`.mapWith(Number),
                })
                .from(workflowLogs)
                .innerJoin(dossiers, eq(workflowLogs.dossierId, dossiers.id))
                .where(and(
                    eq(workflowLogs.toStatus, DossierStatus.APPROVED),
                    gte(workflowLogs.createdAt, todayStart),
                    projectCodes
                        ? (projectCodes.length === 0
                            ? sql`false`
                            : inArray(dossiers.projectCode, projectCodes))
                        : undefined,
                )),
            db
                .select({
                    count: sql<number>`count(*)`.mapWith(Number),
                })
                .from(workflowLogs)
                .innerJoin(dossiers, eq(workflowLogs.dossierId, dossiers.id))
                .where(and(
                    eq(workflowLogs.toStatus, DossierStatus.APPROVED),
                    gte(workflowLogs.createdAt, weekStart),
                    projectCodes
                        ? (projectCodes.length === 0
                            ? sql`false`
                            : inArray(dossiers.projectCode, projectCodes))
                        : undefined,
                )),
            db.query.groups.findMany({
                where: and(...groupConditions),
                columns: {
                    id: true,
                    name: true,
                },
            }),
            aggregateDossierChart(chartGranularity, projectCodes),
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

        const completedDossiers = byStatus[DossierStatus.APPROVED] ?? 0;
        const makerCorrect = makerAccuracyRow[0]?.correct ?? 0;
        const makerIncorrect = makerAccuracyRow[0]?.incorrect ?? 0;
        const reviewedForAccuracy = makerCorrect + makerIncorrect;

        let totalProjects = 0;
        let completedProjects = 0;
        for (const row of projectStatusRows) {
            totalProjects += row.count;
            if (row.status === ProjectStatus.ACCEPTED) {
                completedProjects += row.count;
            }
        }

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
            systemDossiers: {
                total: totalDossiers,
                completed: completedDossiers,
                completionRate: calcRate(completedDossiers, totalDossiers),
                accuracyRate: calcRate(makerCorrect, reviewedForAccuracy),
            },
            systemProjects: {
                total: totalProjects,
                completed: completedProjects,
                completionRate: calcRate(completedProjects, totalProjects),
            },
            dossierChart,
            performance: {
                overallApprovalRate: calcRate(qcApproved, qcReviewed),
                avgProcessingTimeSeconds: roundSeconds(
                    makerPerformanceRow[0]?.avgProcessingTimeSeconds ?? 0,
                ),
                dossiersApprovedToday: approvedTodayRow[0]?.count ?? 0,
                dossiersApprovedThisWeek: approvedWeekRow[0]?.count ?? 0,
            },
            groups: groupSummaries
        };
    },

    async getWarehouseStats(chartGranularity: ChartGranularity = "month") {
        const dossierScope = scopedDossierCondition();

        const [statusRows, dossierChart] = await Promise.all([
            db
                .select({
                    status: dossiers.status,
                    count: sql<number>`count(*)`.mapWith(Number),
                })
                .from(dossiers)
                .where(dossierScope)
                .groupBy(dossiers.status),
            aggregateDossierChart(chartGranularity),
        ]);

        const byStatus: Record<string, number> = {};
        let totalDossiers = 0;
        for (const row of statusRows) {
            byStatus[row.status] = row.count;
            totalDossiers += row.count;
        }

        return {
            totalDossiers,
            byStatus,
            dossierChart,
        };
    },

    async getWarehouseBorrowStats() {
        const borrowStats = { pending: 0, approved: 0, returned: 0, rejected: 0, total: 0 };
        try {
            // Truy vấn trực tiếp từ bảng archiveBorrowRequests
            const result = await db
                .select({
                    status: archiveBorrowRequests.status,
                    count: sql<number>`count(*)::int`,
                })
                .from(archiveBorrowRequests)
                .groupBy(archiveBorrowRequests.status);

            for (const row of result) {
                const status = String(row.status).toUpperCase();
                if (status === 'PENDING') {
                    borrowStats.pending = row.count;
                } else if (status === 'APPROVED' || status === 'ACTIVE') {
                    // Gộp cả hai trạng thái APPROVED và ACTIVE vào danh mục "Số Đang Mượn (Đọc Online)"
                    borrowStats.approved += row.count;
                } else if (status === 'EXPIRED' || status === 'REVOKED' || status === 'RETURNED') {
                    // Trạng thái EXPIRED và REVOKED đại diện cho phiếu đã kết thúc/hết hạn
                    borrowStats.returned += row.count;
                } else if (status === 'REJECTED') {
                    borrowStats.rejected = row.count;
                }
            }
        } catch {
            // Nhánh dự phòng cho bảng cấu trúc cũ (dossier_borrow_requests)
            try {
                const result = await db.execute(sql`
                    SELECT status, COUNT(*)::int as count 
                    FROM dossier_borrow_requests 
                    GROUP BY status
                `);
                
                // Giải quyết lỗi ts(2339): Lấy mảng trực tiếp từ result, 
                // hoặc fallback về .rows nếu driver thô trả về cấu trúc thô.
                const rows = (Array.isArray(result) ? result : (result as any).rows ?? result) as any[];

                for (const row of rows) {
                    const status = String(row.status).toUpperCase();
                    if (status === 'PENDING') borrowStats.pending = row.count;
                    else if (status === 'APPROVED' || status === 'ACTIVE') borrowStats.approved += row.count;
                    else if (status === 'RETURNED' || status === 'EXPIRED') borrowStats.returned += row.count;
                    else if (status === 'REJECTED') borrowStats.rejected = row.count;
                }
            } catch {}
        }
        borrowStats.total = borrowStats.pending + borrowStats.approved + borrowStats.returned + borrowStats.rejected;
        return borrowStats;
    },

    async getWarehouseDisposalCandidates() {
        try {
            // Sử dụng Drizzle ORM thực hiện Left Join an toàn giữa dossiers và fonds
            const items = await db
                .select({
                    dossierId: dossiers.id,
                    id: dossiers.id,
                    dossierName: dossiers.name,
                    name: dossiers.name,
                    fondName: fonds.fondName,
                })
                .from(dossiers)
                .leftJoin(
                    fonds,
                    and(
                        eq(dossiers.fondId, fonds.id),
                        isNull(fonds.deletedAt)
                    )
                )
                .where(
                    and(
                        eq(dossiers.status, DossierStatus.APPROVED), // Hoặc DossierStatus.ARCHIVED tùy theo trạng thái lưu kho của bạn
                        isNull(dossiers.deletedAt),
                        isNotNull(dossiers.expiresAt),
                        lte(dossiers.expiresAt, sql`NOW()`)
                    )
                )
                .orderBy(desc(dossiers.expiresAt))
                .limit(5);

            return { items, total: items.length };
        } catch {
            // Fallback an toàn nếu có sự cố liên kết bảng phông
            try {
                const items = await db
                    .select({
                        id: dossiers.id,
                        dossierId: dossiers.id,
                        name: dossiers.name,
                        dossierName: dossiers.name,
                    })
                    .from(dossiers)
                    .where(
                        and(
                            eq(dossiers.status, DossierStatus.APPROVED),
                            isNull(dossiers.deletedAt)
                        )
                    )
                    .limit(5);
                return { items, total: items.length };
            } catch {
                return { items: [], total: 0 };
            }
        }   
    }
};

