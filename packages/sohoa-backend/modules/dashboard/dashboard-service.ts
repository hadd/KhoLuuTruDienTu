import { httpError } from "@shared/common-lib";
// Bổ sung: desc, isNotNull, lte
import { and, desc, eq, gte, inArray, isNotNull, isNull, like, lte, ne, or, sql } from "drizzle-orm";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { ArchiveDisposalService } from "../archive-disposal/archive-disposal-service.ts";

// Import các schemas bị thiếu
import { archiveBorrowRequests } from "../../db/schemas/archive-borrow.ts";
import { fonds } from "../../db/schemas/fond.ts";
import {
    disposalProposalCatalogs,
    disposalProposalItems,
} from "../../db/schemas/archive-disposal.ts";

import { getPdfPageCount } from "../../libs/pdf-page-counter.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
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
    CHECKER_REJECTED_STATUSES,
    DossierStatus,
    QC_CHECKER_WORKFLOW,
    WorkerRole,
    WorkQuality,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { UserWithRoles } from "../../libs/plugins/auth-profile.ts";

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

type ChartGranularity = "day" | "month" | "quarter" | "year";

const CHART_RANGE_LENGTH: Record<ChartGranularity, number> = {
    day: 30,
    month: 12,
    quarter: 8,
    year: 5,
};

function startOfQuarter(date: Date): Date {
    const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
    return new Date(date.getFullYear(), quarterStartMonth, 1);
}

function startOfChartRange(granularity: ChartGranularity): Date {
    const now = startOfToday();
    if (granularity === "day") {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (CHART_RANGE_LENGTH.day - 1));
    }
    if (granularity === "month") {
        return new Date(now.getFullYear(), now.getMonth() - (CHART_RANGE_LENGTH.month - 1), 1);
    }
    if (granularity === "quarter") {
        const currentQuarterStart = startOfQuarter(now);
        return new Date(
            currentQuarterStart.getFullYear(),
            currentQuarterStart.getMonth() - (CHART_RANGE_LENGTH.quarter - 1) * 3,
            1,
        );
    }
    return new Date(now.getFullYear() - (CHART_RANGE_LENGTH.year - 1), 0, 1);
}

function parseOptionalDate(value?: string | Date, endOfDay = false): Date | undefined {
    if (!value) {
        return undefined;
    }
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        return undefined;
    }
    if (endOfDay && typeof value === "string" && value.length === 10) {
        date.setHours(23, 59, 59, 999);
    }
    return date;
}

function formatChartPeriod(date: Date, granularity: ChartGranularity): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    if (granularity === "year") {
        return String(year);
    }
    if (granularity === "quarter") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `${year}-Q${quarter}`;
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
    if (granularity === "quarter") {
        return new Date(date.getFullYear(), date.getMonth() + 3, 1);
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

function dossierProjectCondition(projectCodes?: string[], includeUnassigned: boolean = false) {
    if (!projectCodes) {
        return undefined;
    }
    if (projectCodes.length === 0) {
        return includeUnassigned ? isNull(dossiers.projectCode) : sql`false`;
    }
    return includeUnassigned
        ? or(inArray(dossiers.projectCode, projectCodes), isNull(dossiers.projectCode))
        : inArray(dossiers.projectCode, projectCodes);
}

function scopedDossierCondition(projectCodes?: string[], includeUnassigned: boolean = false) {
    const cond = dossierProjectCondition(projectCodes, includeUnassigned);
    return activeDossierWhere(cond);
}

const UNENTERED_STATUSES = [
    DossierStatus.NEW,
    DossierStatus.OCR_PROCESSING,
    DossierStatus.OCR_FAILED,
    DossierStatus.READY_FOR_ENTRY,
] as const;

const ERROR_STATUSES = [
    DossierStatus.ERROR,
    DossierStatus.WAITING_ISSUE_RESOLUTION,
] as const;

const COMPLETED_STATUSES = [
    DossierStatus.APPROVED,
    DossierStatus.PENDING_ARCHIVE,
    DossierStatus.ARCHIVE_REJECTED,
    DossierStatus.ARCHIVED,
] as const;

type WorkloadVolume = { dossiers: number; files: number; pages: number };

async function aggregateWorkloadStats(
    projectCodes?: string[],
    includeUnassigned: boolean = false,
) {
    const scope = scopedDossierCondition(projectCodes, includeUnassigned);

    const activeAssignmentExists = sql`exists (
        select 1 from ${dossierAssignments}
        where ${dossierAssignments.dossierId} = ${dossiers.id}
          and ${dossierAssignments.status} <> ${AssignmentStatus.TRANSFERRED}
    )`;

    const isUnentered = inArray(dossiers.status, [...UNENTERED_STATUSES]);
    const isError = or(
        inArray(dossiers.status, [
            ...ERROR_STATUSES,
            ...CHECKER_REJECTED_STATUSES,
        ]),
        sql`exists (
            select 1 from ${dossierAssignments}
            where ${dossierAssignments.dossierId} = ${dossiers.id}
              and (${dossierAssignments.status} = ${AssignmentStatus.REJECTED} or ${dossierAssignments.workQuality} = ${WorkQuality.INCORRECT})
        )`
    );
    const isCompleted = inArray(dossiers.status, [...COMPLETED_STATUSES]);

    const [row] = await db
        .select({
            totalDossiers: sql<number>`count(distinct ${dossiers.id})`.mapWith(Number),
            totalFiles: sql<number>`count(${dossierFiles.id})`.mapWith(Number),
            totalPages: sql<number>`coalesce(sum(coalesce(${dossierFiles.pageCount}, 1)), 0)`.mapWith(Number),
            unenteredDossiers: sql<number>`count(distinct case when ${isUnentered} then ${dossiers.id} end)`.mapWith(Number),
            unenteredFiles: sql<number>`count(case when ${isUnentered} then ${dossierFiles.id} end)`.mapWith(Number),
            unenteredPages: sql<number>`coalesce(sum(case when ${isUnentered} then coalesce(${dossierFiles.pageCount}, 1) else 0 end), 0)`.mapWith(Number),
            unassignedDossiers: sql<number>`count(distinct case when not ${activeAssignmentExists} then ${dossiers.id} end)`.mapWith(Number),
            unassignedFiles: sql<number>`count(case when not ${activeAssignmentExists} then ${dossierFiles.id} end)`.mapWith(Number),
            unassignedPages: sql<number>`coalesce(sum(case when not ${activeAssignmentExists} then coalesce(${dossierFiles.pageCount}, 1) else 0 end), 0)`.mapWith(Number),
            completedDossiers: sql<number>`count(distinct case when ${isCompleted} then ${dossiers.id} end)`.mapWith(Number),
            completedFiles: sql<number>`count(case when ${isCompleted} then ${dossierFiles.id} end)`.mapWith(Number),
            completedPages: sql<number>`coalesce(sum(case when ${isCompleted} then coalesce(${dossierFiles.pageCount}, 1) else 0 end), 0)`.mapWith(Number),
            errorDossiers: sql<number>`count(distinct case when ${isError} then ${dossiers.id} end)`.mapWith(Number),
            errorFiles: sql<number>`count(case when ${isError} then ${dossierFiles.id} end)`.mapWith(Number),
            errorPages: sql<number>`coalesce(sum(case when ${isError} then coalesce(${dossierFiles.pageCount}, 1) else 0 end), 0)`.mapWith(Number),
        })
        .from(dossiers)
        .leftJoin(dossierFiles, eq(dossierFiles.dossierId, dossiers.id))
        .where(scope);

    return {
        total: {
            dossiers: row?.totalDossiers ?? 0,
            files: row?.totalFiles ?? 0,
            pages: row?.totalPages ?? 0,
        },
        unentered: {
            dossiers: row?.unenteredDossiers ?? 0,
            files: row?.unenteredFiles ?? 0,
            pages: row?.unenteredPages ?? 0,
        },
        unassigned: {
            dossiers: row?.unassignedDossiers ?? 0,
            files: row?.unassignedFiles ?? 0,
            pages: row?.unassignedPages ?? 0,
        },
        completed: {
            dossiers: row?.completedDossiers ?? 0,
            files: row?.completedFiles ?? 0,
            pages: row?.completedPages ?? 0,
        },
        error: {
            dossiers: row?.errorDossiers ?? 0,
            files: row?.errorFiles ?? 0,
            pages: row?.errorPages ?? 0,
        },
    } satisfies Record<string, WorkloadVolume>;
}

async function aggregateDossierChart(
    granularity: ChartGranularity,
    projectCodes?: string[],
    includeUnassigned: boolean = false,
    dateFrom?: string | Date,
    dateTo?: string | Date,
) {
    const parsedFrom = parseOptionalDate(dateFrom);
    const parsedTo = parseOptionalDate(dateTo, true);
    const rangeStart = parsedFrom
        ? (granularity === "quarter"
            ? startOfQuarter(parsedFrom)
            : granularity === "month"
                ? new Date(parsedFrom.getFullYear(), parsedFrom.getMonth(), 1)
                : granularity === "year"
                    ? new Date(parsedFrom.getFullYear(), 0, 1)
                    : new Date(parsedFrom.getFullYear(), parsedFrom.getMonth(), parsedFrom.getDate()))
        : startOfChartRange(granularity);
    const rangeEnd = parsedTo ?? startOfToday();

    const periodBucket = granularity === "day"
        ? sql`date_trunc('day', ${workflowLogs.createdAt})`
        : granularity === "month"
            ? sql`date_trunc('month', ${workflowLogs.createdAt})`
            : granularity === "quarter"
                ? sql`date_trunc('quarter', ${workflowLogs.createdAt})`
                : sql`date_trunc('year', ${workflowLogs.createdAt})`;

    const chartConditions = [
        scopedDossierCondition(projectCodes, includeUnassigned),
        gte(workflowLogs.createdAt, rangeStart),
    ];
    if (parsedTo) {
        chartConditions.push(lte(workflowLogs.createdAt, parsedTo));
    }

    const rows = await db
        .select({
            period: sql<Date>`${periodBucket}`,
            editedCompleted: sql<number>`count(distinct case when ${workflowLogs.action} = 'SUBMIT_ENTRY' then ${workflowLogs.dossierId} end)`.mapWith(Number),
            fullyCompleted: sql<number>`count(distinct case when ${workflowLogs.toStatus} = ${DossierStatus.APPROVED} then ${workflowLogs.dossierId} end)`.mapWith(Number),
        })
        .from(workflowLogs)
        .innerJoin(dossiers, eq(workflowLogs.dossierId, dossiers.id))
        .where(and(...chartConditions))
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

/** Build admin dashboard group cards with a few batched queries (no per-group N+1). */
async function buildGroupSummaries(
    activeGroups: Array<{ id: string; name: string }>,
) {
    if (activeGroups.length === 0) {
        return [];
    }

    const groupIds = activeGroups.map((group) => group.id);

    const [dossierRows, members] = await Promise.all([
        db
            .select({
                groupId: dossiers.assignedGroupId,
                totalDossiers: sql<number>`count(*)`.mapWith(Number),
                approved: sql<number>`coalesce(sum(case when ${dossiers.status} = ${DossierStatus.APPROVED} then 1 else 0 end), 0)`.mapWith(Number),
            })
            .from(dossiers)
            .where(activeDossierWhere(inArray(dossiers.assignedGroupId, groupIds)))
            .groupBy(dossiers.assignedGroupId),
        db.query.groupMembers.findMany({
            where: and(
                inArray(groupMembers.groupId, groupIds),
                isNull(groupMembers.expiredAt),
            ),
            columns: {
                groupId: true,
                userId: true,
                role: true,
            },
        }),
    ]);

    const dossierByGroup = new Map(
        dossierRows
            .filter((row) => row.groupId != null)
            .map((row) => [row.groupId as string, row]),
    );

    const membersByGroup = new Map<string, Array<{ userId: string; role: string }>>();
    for (const member of members) {
        const list = membersByGroup.get(member.groupId) ?? [];
        list.push({ userId: member.userId, role: member.role });
        membersByGroup.set(member.groupId, list);
    }

    const editorUserIds = [
        ...new Set(
            members
                .filter((member) => member.role === "editor")
                .map((member) => member.userId),
        ),
    ];
    const qcUserIds = [
        ...new Set(
            members
                .filter((member) => member.role.startsWith("qc"))
                .map((member) => member.userId),
        ),
    ];

    const editorRows = editorUserIds.length === 0
        ? []
        : await db
            .select({
                groupId: dossiers.assignedGroupId,
                assigneeId: dossierAssignments.assigneeId,
                correct: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.workQuality} = ${WorkQuality.CORRECT} then 1 else 0 end), 0)`.mapWith(Number),
                incorrect: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.workQuality} = ${WorkQuality.INCORRECT} then 1 else 0 end), 0)`.mapWith(Number),
            })
            .from(dossierAssignments)
            .innerJoin(dossiers, eq(dossierAssignments.dossierId, dossiers.id))
            .where(activeDossierWhere(
                inArray(dossierAssignments.assigneeId, editorUserIds),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                inArray(dossiers.assignedGroupId, groupIds),
            ))
            .groupBy(dossiers.assignedGroupId, dossierAssignments.assigneeId);

    const qcRows = qcUserIds.length === 0
        ? []
        : await db
            .select({
                groupId: dossiers.assignedGroupId,
                assigneeId: dossierAssignments.assigneeId,
                reviewed: sql<number>`count(*)`.mapWith(Number),
                approved: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then 1 else 0 end), 0)`.mapWith(Number),
            })
            .from(dossierAssignments)
            .innerJoin(dossiers, eq(dossierAssignments.dossierId, dossiers.id))
            .where(activeDossierWhere(
                inArray(dossierAssignments.assigneeId, qcUserIds),
                inArray(dossierAssignments.role, CHECKER_ROLES),
                inArray(dossierAssignments.status, [
                    AssignmentStatus.COMPLETED,
                    AssignmentStatus.REJECTED,
                ]),
                inArray(dossiers.assignedGroupId, groupIds),
            ))
            .groupBy(dossiers.assignedGroupId, dossierAssignments.assigneeId);

    const editorRateByGroupUser = new Map<string, number>();
    for (const row of editorRows) {
        if (!row.groupId) continue;
        editorRateByGroupUser.set(
            `${row.groupId}:${row.assigneeId}`,
            calcRate(row.correct, row.correct + row.incorrect),
        );
    }

    const qcRateByGroupUser = new Map<string, number>();
    for (const row of qcRows) {
        if (!row.groupId) continue;
        qcRateByGroupUser.set(
            `${row.groupId}:${row.assigneeId}`,
            calcRate(row.approved, row.reviewed),
        );
    }

    return activeGroups.map((group) => {
        const dossierSummary = dossierByGroup.get(group.id);
        const groupMembersList = membersByGroup.get(group.id) ?? [];
        const editorMembers = groupMembersList.filter((member) => member.role === "editor");
        const qcMemberUserIds = groupMembersList
            .filter((member) => member.role.startsWith("qc"))
            .map((member) => member.userId);

        const editorRates = editorMembers.map((member) =>
            editorRateByGroupUser.get(`${group.id}:${member.userId}`) ?? 0
        );
        const qcRates = qcMemberUserIds.map((userId) =>
            qcRateByGroupUser.get(`${group.id}:${userId}`) ?? 0
        );

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
    });
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
                ne(dossierAssignments.status, AssignmentStatus.TRANSFERRED),
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
                ne(dossierAssignments.status, AssignmentStatus.TRANSFERRED),
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
                ne(dossierAssignments.status, AssignmentStatus.TRANSFERRED),
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

    async syncExistingPdfPageCounts() {
        try {
            const uncountedPdfFiles = await db.query.dossierFiles.findMany({
                where: and(
                    like(dossierFiles.fileName, "%.pdf"),
                    eq(dossierFiles.pageCount, 1),
                ),
                limit: 20,
            });

            for (const file of uncountedPdfFiles) {
                const realCount = await getPdfPageCount(file.filePath);
                if (realCount > 1) {
                    await db
                        .update(dossierFiles)
                        .set({ pageCount: realCount })
                        .where(eq(dossierFiles.id, file.id));
                }
            }
        } catch {
            // Ignore background sync errors
        }
    },

    async aggregateEmployeeKpis(
        projectCodes?: string[],
        includeUnassigned: boolean = false,
        dateFrom?: string | Date,
        dateTo?: string | Date,
    ) {
        // Never block dashboard/API on MinIO page-count sync (can take >30s on remote storage).
        void this.syncExistingPdfPageCounts();
        const activeUsers = await db.query.userProfiles.findMany({
            where: and(
                eq(userProfiles.active, true),
                isNull(userProfiles.deletedAt),
            ),
            columns: {
                id: true,
                fullName: true,
            },
            with: {
                userRoles: {
                    where: isNull(userRoles.expiredAt),
                    columns: {
                        roleId: true,
                    },
                    with: {
                        role: {
                            columns: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                groupMembers: {
                    where: isNull(groupMembers.expiredAt),
                    with: {
                        group: {
                            columns: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        if (activeUsers.length === 0) {
            return [];
        }

        const userIds = activeUsers.map((u) => u.id);

        const dossierFileCounts = db
            .select({
                dossierId: dossierFiles.dossierId,
                fileCount: sql<number>`count(*)`.mapWith(Number).as("file_count"),
                pageCount: sql<number>`coalesce(sum(coalesce(${dossierFiles.pageCount}, 1)), 0)`.mapWith(Number).as("page_count"),
            })
            .from(dossierFiles)
            .groupBy(dossierFiles.dossierId)
            .as("dossier_file_counts");

        const assignmentConditions = [
            inArray(dossierAssignments.assigneeId, userIds),
            ne(dossierAssignments.status, AssignmentStatus.TRANSFERRED),
            dossierProjectCondition(projectCodes, includeUnassigned),
        ];

        if (dateFrom) {
            const dFrom = typeof dateFrom === "string" ? new Date(dateFrom) : dateFrom;
            if (!isNaN(dFrom.getTime())) {
                assignmentConditions.push(gte(dossierAssignments.assignedAt, dFrom));
            }
        }
        if (dateTo) {
            const dTo = typeof dateTo === "string" ? new Date(dateTo) : dateTo;
            if (!isNaN(dTo.getTime())) {
                if (typeof dateTo === "string" && dateTo.length === 10) {
                    dTo.setHours(23, 59, 59, 999);
                }
                assignmentConditions.push(lte(dossierAssignments.assignedAt, dTo));
            }
        }

        const assignmentStats = await db
            .select({
                assigneeId: dossierAssignments.assigneeId,
                assignedDossiersCount: sql<number>`count(distinct ${dossierAssignments.dossierId})`.mapWith(Number),
                completedDossiersCount: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then 1 else 0 end), 0)`.mapWith(Number),
                rejectedDossiersCount: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.REJECTED} or ${dossierAssignments.workQuality} = ${WorkQuality.INCORRECT} then 1 else 0 end), 0)`.mapWith(Number),
                correctCount: sql<number>`coalesce(sum(case when ${dossierAssignments.workQuality} = ${WorkQuality.CORRECT} then 1 else 0 end), 0)`.mapWith(Number),
                incorrectCount: sql<number>`coalesce(sum(case when ${dossierAssignments.workQuality} = ${WorkQuality.INCORRECT} then 1 else 0 end), 0)`.mapWith(Number),
                avgProcessingTimeSeconds: sql<number>`coalesce(avg(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.completedAt} is not null then extract(epoch from (${dossierAssignments.completedAt} - ${dossierAssignments.assignedAt})) end), 0)`.mapWith(Number),
                makerAssignedDossiersCount: sql<number>`coalesce(sum(case when ${dossierAssignments.role} = ${WorkerRole.MAKER} then 1 else 0 end), 0)`.mapWith(Number),
                makerCompletedDossiersCount: sql<number>`coalesce(sum(case when ${dossierAssignments.role} = ${WorkerRole.MAKER} and ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then 1 else 0 end), 0)`.mapWith(Number),
                qcAssignedDossiersCount: sql<number>`coalesce(sum(case when ${dossierAssignments.role} <> ${WorkerRole.MAKER} then 1 else 0 end), 0)`.mapWith(Number),
                qcCompletedDossiersCount: sql<number>`coalesce(sum(case when ${dossierAssignments.role} <> ${WorkerRole.MAKER} and ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then 1 else 0 end), 0)`.mapWith(Number),
                assignedPagesCount: sql<number>`coalesce(sum(coalesce(${dossierFileCounts.pageCount}, 0)), 0)`.mapWith(Number),
                completedPagesCount: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then coalesce(${dossierFileCounts.pageCount}, 0) else 0 end), 0)`.mapWith(Number),
                makerAssignedPagesCount: sql<number>`coalesce(sum(case when ${dossierAssignments.role} = ${WorkerRole.MAKER} then coalesce(${dossierFileCounts.pageCount}, 0) else 0 end), 0)`.mapWith(Number),
                makerCompletedPagesCount: sql<number>`coalesce(sum(case when ${dossierAssignments.role} = ${WorkerRole.MAKER} and ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then coalesce(${dossierFileCounts.pageCount}, 0) else 0 end), 0)`.mapWith(Number),
                qcAssignedPagesCount: sql<number>`coalesce(sum(case when ${dossierAssignments.role} <> ${WorkerRole.MAKER} then coalesce(${dossierFileCounts.pageCount}, 0) else 0 end), 0)`.mapWith(Number),
                qcCompletedPagesCount: sql<number>`coalesce(sum(case when ${dossierAssignments.role} <> ${WorkerRole.MAKER} and ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then coalesce(${dossierFileCounts.pageCount}, 0) else 0 end), 0)`.mapWith(Number),
                assignedFilesCount: sql<number>`coalesce(sum(coalesce(${dossierFileCounts.fileCount}, 0)), 0)`.mapWith(Number),
                completedFilesCount: sql<number>`coalesce(sum(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then coalesce(${dossierFileCounts.fileCount}, 0) else 0 end), 0)`.mapWith(Number),
                makerAssignedFilesCount: sql<number>`coalesce(sum(case when ${dossierAssignments.role} = ${WorkerRole.MAKER} then coalesce(${dossierFileCounts.fileCount}, 0) else 0 end), 0)`.mapWith(Number),
                makerCompletedFilesCount: sql<number>`coalesce(sum(case when ${dossierAssignments.role} = ${WorkerRole.MAKER} and ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then coalesce(${dossierFileCounts.fileCount}, 0) else 0 end), 0)`.mapWith(Number),
                qcAssignedFilesCount: sql<number>`coalesce(sum(case when ${dossierAssignments.role} <> ${WorkerRole.MAKER} then coalesce(${dossierFileCounts.fileCount}, 0) else 0 end), 0)`.mapWith(Number),
                qcCompletedFilesCount: sql<number>`coalesce(sum(case when ${dossierAssignments.role} <> ${WorkerRole.MAKER} and ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} then coalesce(${dossierFileCounts.fileCount}, 0) else 0 end), 0)`.mapWith(Number),
            })
            .from(dossierAssignments)
            .innerJoin(dossiers, eq(dossierAssignments.dossierId, dossiers.id))
            .leftJoin(dossierFileCounts, eq(dossierAssignments.dossierId, dossierFileCounts.dossierId))
            .where(activeDossierWhere(...assignmentConditions))
            .groupBy(dossierAssignments.assigneeId);

        const statsMap = new Map(assignmentStats.map((row) => [row.assigneeId, row]));

        return activeUsers.map((user) => {
            const stats = statsMap.get(user.id) ?? {
                assignedDossiersCount: 0,
                completedDossiersCount: 0,
                rejectedDossiersCount: 0,
                correctCount: 0,
                incorrectCount: 0,
                avgProcessingTimeSeconds: 0,
                makerAssignedDossiersCount: 0,
                makerCompletedDossiersCount: 0,
                qcAssignedDossiersCount: 0,
                qcCompletedDossiersCount: 0,
                assignedPagesCount: 0,
                completedPagesCount: 0,
                makerAssignedPagesCount: 0,
                makerCompletedPagesCount: 0,
                qcAssignedPagesCount: 0,
                qcCompletedPagesCount: 0,
                assignedFilesCount: 0,
                completedFilesCount: 0,
                makerAssignedFilesCount: 0,
                makerCompletedFilesCount: 0,
                qcAssignedFilesCount: 0,
                qcCompletedFilesCount: 0,
            };

            const userRolesList = user.userRoles ?? [];
            const roleIds = userRolesList.map((r) => (r.roleId ?? "").toLowerCase());
            const roleNames = userRolesList.map((r) => (r.role?.name ?? "").toLowerCase());

            let primaryRole = "editor";
            if (
                roleIds.includes("admin") ||
                roleIds.includes("superadmin") ||
                roleNames.some((n) => n.includes("quản trị"))
            ) {
                primaryRole = "admin";
            } else if (
                roleIds.some((r) => r.startsWith("qc") || r.includes("checker")) ||
                roleNames.some((n) => n.includes("kiểm duyệt") || n.includes("qc"))
            ) {
                primaryRole = "qc";
            } else if (
                roleIds.some((r) => r.includes("editor") || r.includes("maker")) ||
                roleNames.some((n) => n.includes("biên tập"))
            ) {
                primaryRole = "editor";
            } else if (userRolesList.length > 0 && userRolesList[0]?.role?.id) {
                primaryRole = userRolesList[0].role.id;
            } else if (userRolesList.length > 0) {
                primaryRole = userRolesList[0].roleId;
            }

            const groupObj = user.groupMembers?.[0]?.group;
            const groupId = groupObj?.id ?? null;
            const groupName = groupObj?.name ?? null;

            const assignedPagesCount = stats.assignedPagesCount;
            const completedPagesCount = stats.completedPagesCount;
            const assignedFilesCount = stats.assignedFilesCount;
            const completedFilesCount = stats.completedFilesCount;

            const dossierCompletionRate = calcRate(stats.completedDossiersCount, stats.assignedDossiersCount);
            const pageCompletionRate = calcRate(completedPagesCount, assignedPagesCount);
            const fileCompletionRate = calcRate(completedFilesCount, assignedFilesCount);

            const makerAssignedDossiersCount = stats.makerAssignedDossiersCount || (primaryRole === "editor" ? stats.assignedDossiersCount : 0);
            const makerCompletedDossiersCount = stats.makerCompletedDossiersCount || (primaryRole === "editor" ? stats.completedDossiersCount : 0);
            const makerAssignedPagesCount = stats.makerAssignedPagesCount || (primaryRole === "editor" ? assignedPagesCount : 0);
            const makerCompletedPagesCount = stats.makerCompletedPagesCount || (primaryRole === "editor" ? completedPagesCount : 0);
            const makerAssignedFilesCount = stats.makerAssignedFilesCount || (primaryRole === "editor" ? assignedFilesCount : 0);
            const makerCompletedFilesCount = stats.makerCompletedFilesCount || (primaryRole === "editor" ? completedFilesCount : 0);
            const makerDossierCompletionRate = calcRate(makerCompletedDossiersCount, makerAssignedDossiersCount);
            const makerPageCompletionRate = calcRate(makerCompletedPagesCount, makerAssignedPagesCount);
            const makerFileCompletionRate = calcRate(makerCompletedFilesCount, makerAssignedFilesCount);

            const qcAssignedDossiersCount = stats.qcAssignedDossiersCount || (primaryRole === "qc" ? stats.assignedDossiersCount : 0);
            const qcCompletedDossiersCount = stats.qcCompletedDossiersCount || (primaryRole === "qc" ? stats.completedDossiersCount : 0);
            const qcAssignedPagesCount = stats.qcAssignedPagesCount || (primaryRole === "qc" ? assignedPagesCount : 0);
            const qcCompletedPagesCount = stats.qcCompletedPagesCount || (primaryRole === "qc" ? completedPagesCount : 0);
            const qcAssignedFilesCount = stats.qcAssignedFilesCount || (primaryRole === "qc" ? assignedFilesCount : 0);
            const qcCompletedFilesCount = stats.qcCompletedFilesCount || (primaryRole === "qc" ? completedFilesCount : 0);
            const qcDossierCompletionRate = calcRate(qcCompletedDossiersCount, qcAssignedDossiersCount);
            const qcPageCompletionRate = calcRate(qcCompletedPagesCount, qcAssignedPagesCount);
            const qcFileCompletionRate = calcRate(qcCompletedFilesCount, qcAssignedFilesCount);

            const reviewedForAccuracy = stats.correctCount + stats.incorrectCount;
            const accuracyRate = reviewedForAccuracy > 0
                ? calcRate(stats.correctCount, reviewedForAccuracy)
                : (stats.completedDossiersCount > 0 ? 100 : 0);

            const avgProcessingTimeMinutes = Math.round(stats.avgProcessingTimeSeconds / 60);

            let kpiStatus: "EXCELLENT" | "GOOD" | "WARNING" | "CRITICAL" = "GOOD";
            if (accuracyRate >= 95 && dossierCompletionRate >= 90) {
                kpiStatus = "EXCELLENT";
            } else if (accuracyRate >= 80 && dossierCompletionRate >= 80) {
                kpiStatus = "GOOD";
            } else if (accuracyRate >= 70 || dossierCompletionRate >= 70) {
                kpiStatus = "WARNING";
            } else {
                kpiStatus = "CRITICAL";
            }

            return {
                userId: user.id,
                fullName: user.fullName || "Chưa đặt tên",
                role: primaryRole,
                groupId,
                groupName,
                assignedDossiersCount: stats.assignedDossiersCount,
                completedDossiersCount: stats.completedDossiersCount,
                rejectedDossiersCount: stats.rejectedDossiersCount,
                assignedPagesCount,
                completedPagesCount,
                assignedFilesCount,
                completedFilesCount,
                dossierCompletionRate,
                pageCompletionRate,
                fileCompletionRate,
                makerAssignedDossiersCount,
                makerCompletedDossiersCount,
                makerAssignedPagesCount,
                makerCompletedPagesCount,
                makerAssignedFilesCount,
                makerCompletedFilesCount,
                makerDossierCompletionRate,
                makerPageCompletionRate,
                makerFileCompletionRate,
                qcAssignedDossiersCount,
                qcCompletedDossiersCount,
                qcAssignedPagesCount,
                qcCompletedPagesCount,
                qcAssignedFilesCount,
                qcCompletedFilesCount,
                qcDossierCompletionRate,
                qcPageCompletionRate,
                qcFileCompletionRate,
                accuracyRate,
                avgProcessingTimeMinutes,
                kpiStatus,
            };
        }).filter((item) => {
            // Ẩn admin tổng / quản trị viên khỏi danh sách KPI nhân sự
            if (item.role === "admin") {
                return false;
            }
            // Chỉ hiện những người được giao hồ sơ (assignedDossiersCount > 0)
            const totalAssigned = item.assignedDossiersCount + (item.makerAssignedDossiersCount ?? 0) + (item.qcAssignedDossiersCount ?? 0);
            if (totalAssigned <= 0 && item.assignedDossiersCount <= 0) {
                return false;
            }
            return true;
        });
    },

    async getAdminDashboard(
        options?: {
            projectCodes?: string[];
            includeUnassigned?: boolean;
        },
    ) {
        const projectCodes = options?.projectCodes;
        const includeUnassigned = options?.includeUnassigned ?? false;
        const isScoped = projectCodes !== undefined;
        const todayStart = startOfToday();
        const weekStart = startOfWeek();

        const dossierScope = scopedDossierCondition(projectCodes, includeUnassigned);
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
            workloadStats,
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
                    dossierProjectCondition(projectCodes, includeUnassigned),
                )),
            db
                .select({
                    avgProcessingTimeSeconds: sql<number>`coalesce(avg(case when ${dossierAssignments.status} = ${AssignmentStatus.COMPLETED} and ${dossierAssignments.completedAt} is not null then extract(epoch from (${dossierAssignments.completedAt} - ${dossierAssignments.assignedAt})) end), 0)`.mapWith(Number),
                })
                .from(dossierAssignments)
                .innerJoin(dossiers, eq(dossierAssignments.dossierId, dossiers.id))
                .where(activeDossierWhere(
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    dossierProjectCondition(projectCodes, includeUnassigned),
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
                    dossierProjectCondition(projectCodes, includeUnassigned),
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
                    dossierProjectCondition(projectCodes, includeUnassigned),
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
                    dossierProjectCondition(projectCodes, includeUnassigned),
                )),
            db.query.groups.findMany({
                where: and(...groupConditions),
                columns: {
                    id: true,
                    name: true,
                },
            }),
            aggregateWorkloadStats(projectCodes, includeUnassigned),
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

        const completedDossiers =
            (byStatus[DossierStatus.APPROVED] ?? 0) +
            (byStatus[DossierStatus.PENDING_ARCHIVE] ?? 0) +
            (byStatus[DossierStatus.ARCHIVE_REJECTED] ?? 0) +
            (byStatus[DossierStatus.ARCHIVED] ?? 0);
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

        const groupSummaries = await buildGroupSummaries(activeGroups);

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
                workloadStats,
                performance: {
                    overallApprovalRate: calcRate(qcApproved, qcReviewed),
                    avgProcessingTimeSeconds: roundSeconds(
                        makerPerformanceRow[0]?.avgProcessingTimeSeconds ?? 0,
                    ),
                    dossiersApprovedToday: approvedTodayRow[0]?.count ?? 0,
                    dossiersApprovedThisWeek: approvedWeekRow[0]?.count ?? 0,
                },
                groups: groupSummaries,
            };
        },

    async getAdminEmployeeKpis(options?: {
        projectCodes?: string[];
        includeUnassigned?: boolean;
        dateFrom?: string | Date;
        dateTo?: string | Date;
    }) {
        const employeeKpis = await this.aggregateEmployeeKpis(
            options?.projectCodes,
            options?.includeUnassigned ?? false,
            options?.dateFrom,
            options?.dateTo,
        );
        return { employeeKpis };
    },

    async getAdminDossierChart(
        chartGranularity: ChartGranularity = "month",
        options?: {
            projectCodes?: string[];
            includeUnassigned?: boolean;
            dateFrom?: string | Date;
            dateTo?: string | Date;
        },
    ) {
        return await aggregateDossierChart(
            chartGranularity,
            options?.projectCodes,
            options?.includeUnassigned ?? false,
            options?.dateFrom,
            options?.dateTo,
        );
    },

    async getWarehouseStats(chartGranularity: "day" | "month" | "year" = "month") {
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
                // const result = await db.execute(sql`
                //     SELECT status, COUNT(*)::int as count 
                //     FROM dossier_borrow_requests 
                //     GROUP BY status
                // `);
                const result = await db.select({
                    status: archiveBorrowRequests.status,
                    count: sql<number>`count(*)::int`,
                }).from(archiveBorrowRequests).groupBy(archiveBorrowRequests.status);

                const rows = (Array.isArray(result) ? result : (result as any).rows ?? result) as any[];

                for (const row of rows) {
                    const status = String(row.status).toUpperCase();
                    if (status === 'PENDING') borrowStats.pending = row.count;
                    else if (status === 'APPROVED' || status === 'ACTIVE') borrowStats.approved += row.count;
                    else if (status === 'RETURNED' || status === 'EXPIRED') borrowStats.returned += row.count;
                    else if (status === 'REJECTED') borrowStats.rejected = row.count;
                }
            } catch { }
        }
        borrowStats.total = borrowStats.pending + borrowStats.approved + borrowStats.returned + borrowStats.rejected;
        return borrowStats;
    },

    async getWarehouseDisposalCandidates(profile: UserWithRoles) {
        try {
            if (!profile) {
                return { items: [], total: 0 };
            }
            const res = await ArchiveDisposalService.listCandidates(profile, {
                category: "all",
                entityKind: "grouped",
                limit: 100,
            });

            const groups = res.groups ?? [];
            const items = groups.map((g) => {
                const dossierItem = g.dossierItem as any;
                const docCategories = g.documentItems.flatMap((doc: any) => doc.categories ?? []);
                const allCategories = Array.from(
                    new Set([
                        ...(dossierItem?.categories ?? []),
                        ...docCategories,
                    ])
                );
                if (allCategories.length === 0) {
                    if (g.expiresAt) allCategories.push("expired");
                    else allCategories.push("duplicate");
                }

                return {
                    id: g.dossierId,
                    dossierId: g.dossierId,
                    itemId: g.dossierId,
                    dossierName: g.dossierName,
                    name: g.dossierName,
                    title: g.dossierName,
                    code: dossierItem?.dossierCode ?? null,
                    fondName: g.fondName,
                    retentionPeriodName: g.retentionPeriodName,
                    expiresAt: g.expiresAt,
                    categories: allCategories,
                    createdAt: g.archivedAt,
                };
            });

            return { items, total: res.total ?? items.length };
        } catch (err) {
            console.error("Error fetching candidates for warehouse disposal dashboard:", err);
            return { items: [], total: 0 };
        }
    }
};

