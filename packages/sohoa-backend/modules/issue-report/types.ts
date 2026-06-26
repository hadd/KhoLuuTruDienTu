import { t, type Static } from "elysia";
import { issueReportStatusSchema } from "../../db/schemas/issue-report-constants.ts";

export const issueReportInputSchema = t.Object({
    type: t.String({ minLength: 1 }),
    notes: t.String({ minLength: 1 }),
});

export type IssueReportInput = Static<typeof issueReportInputSchema>;

export const issueReportResponseSchema = t.Object({
    id: t.String(),
    dossierId: t.String(),
    reporterId: t.String(),
    /** Họ tên người gửi báo cáo. */
    reporterName: t.Optional(t.Union([t.String(), t.Null()])),
    reporterAssignmentId: t.String(),
    status: issueReportStatusSchema,
    type: t.String(),
    notes: t.String(),
    /** Lý do checker từ chối issue report (chỉ có khi status = REJECTED). */
    resolveNotes: t.Optional(t.Union([t.String(), t.Null()])),
    escalatedToId: t.Union([t.String(), t.Null()]),
    createdAt: t.String(),
    resolvedAt: t.Union([t.String(), t.Null()]),
    blocksChecker: t.Boolean(),
    /** true khi PM đóng và hồ sơ không-QC chuyển sang APPROVED. */
    dossierApproved: t.Optional(t.Boolean()),
});

export type IssueReportResponse = Static<typeof issueReportResponseSchema>;

export const issueReportCloseBodySchema = t.Object({
    notes: t.Optional(t.String({ minLength: 1 })),
});

export const issueReportRejectBodySchema = t.Object({
    notes: t.String({ minLength: 1 }),
    reject_fields: t.Optional(t.Array(t.String({ minLength: 1 }))),
});

export const issueReportListQuerySchema = t.Object({
    status: t.Optional(issueReportStatusSchema),
    projectCode: t.Optional(t.String()),
    limit: t.Optional(t.String()),
    offset: t.Optional(t.String()),
});
