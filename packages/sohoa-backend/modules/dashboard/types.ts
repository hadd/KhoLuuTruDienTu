import { t } from "elysia";
import { workerRoleSchema } from "../../db/schemas/workflow-constants.ts";

export const adminChartGranularitySchema = t.Union([
    t.Literal("day"),
    t.Literal("month"),
    t.Literal("year"),
]);

export const adminDashboardQuerySchema = t.Object({
    chartGranularity: t.Optional(adminChartGranularitySchema),
});

export const editorAccuracySchema = t.Object({
    correct: t.Number(),
    incorrect: t.Number(),
    rate: t.Number(),
});

export const editorDashboardResponseSchema = t.Object({
    totalAssigned: t.Number(),
    completed: t.Number(),
    inProgress: t.Number(),
    accuracy: editorAccuracySchema,
    avgProcessingTimeSeconds: t.Number(),
});

export const qcEfficiencySchema = t.Object({
    approvalRate: t.Number(),
    rejectionRate: t.Number(),
});

export const qcByStepSchema = t.Object({
    step: t.Number(),
    role: workerRoleSchema,
    approved: t.Number(),
    rejected: t.Number(),
    pending: t.Number(),
});

export const qcDashboardResponseSchema = t.Object({
    totalAssigned: t.Number(),
    approved: t.Number(),
    rejected: t.Number(),
    reviewed: t.Number(),
    pending: t.Number(),
    efficiency: qcEfficiencySchema,
    byStep: t.Array(qcByStepSchema),
});

export const qcGroupEditorStatsSchema = t.Object({
    userId: t.String(),
    fullName: t.Union([t.String(), t.Null()]),
    completed: t.Number(),
    inProgress: t.Number(),
    correctRate: t.Number(),
    avgProcessingTimeSeconds: t.Number(),
});

export const qcGroupMemberStatsSchema = t.Object({
    userId: t.String(),
    fullName: t.Union([t.String(), t.Null()]),
    role: workerRoleSchema,
    reviewed: t.Number(),
    approved: t.Number(),
    approvalRate: t.Number(),
});

export const qcGroupDashboardResponseSchema = t.Object({
    groupId: t.String(),
    groupName: t.String(),
    totalDossiers: t.Number(),
    approved: t.Number(),
    inProgress: t.Number(),
    progressRate: t.Number(),
    editors: t.Array(qcGroupEditorStatsSchema),
    qcMembers: t.Array(qcGroupMemberStatsSchema),
});

export const adminOverviewSchema = t.Object({
    totalDossiers: t.Number(),
    byStatus: t.Record(t.String(), t.Number()),
    totalActiveUsers: t.Number(),
    byRole: t.Record(t.String(), t.Number()),
    totalGroups: t.Number(),
});

export const adminPerformanceSchema = t.Object({
    overallApprovalRate: t.Number(),
    avgProcessingTimeSeconds: t.Number(),
    dossiersApprovedToday: t.Number(),
    dossiersApprovedThisWeek: t.Number(),
});

export const adminGroupSummarySchema = t.Object({
    groupId: t.String(),
    groupName: t.String(),
    totalDossiers: t.Number(),
    approved: t.Number(),
    progressRate: t.Number(),
    editorCount: t.Number(),
    avgEditorCorrectRate: t.Number(),
    avgQcApprovalRate: t.Number(),
});

export const adminSystemDossiersSchema = t.Object({
    total: t.Number(),
    completed: t.Number(),
    completionRate: t.Number(),
    accuracyRate: t.Number(),
});

export const adminSystemProjectsSchema = t.Object({
    total: t.Number(),
    completed: t.Number(),
    completionRate: t.Number(),
});

export const adminDossierChartPointSchema = t.Object({
    period: t.String(),
    editedCompleted: t.Number(),
    fullyCompleted: t.Number(),
});

export const adminDossierChartSchema = t.Object({
    granularity: adminChartGranularitySchema,
    rangeStart: t.Date(),
    rangeEnd: t.Date(),
    points: t.Array(adminDossierChartPointSchema),
});

export const adminDashboardResponseSchema = t.Object({
    overview: adminOverviewSchema,
    systemDossiers: adminSystemDossiersSchema,
    systemProjects: adminSystemProjectsSchema,
    dossierChart: adminDossierChartSchema,
    performance: adminPerformanceSchema,
    groups: t.Array(adminGroupSummarySchema),
});
