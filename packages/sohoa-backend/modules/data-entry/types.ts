import { t, type Static } from "elysia";
import { assignmentStatusSchema, dossierStatusSchema, workerRoleSchema, workQualitySchema } from "../../db/schemas/workflow-constants.ts";
import { issueReportInputSchema, issueReportResponseSchema } from "../issue-report/types.ts";

export const submitMetadataBodySchema = t.Object({
    metadata: t.Unknown(),
    /** Kèm khi biên tập phát hiện vấn đề tài liệu: có cấp duyệt → CHECKER_1; không có cấp duyệt → quản lý dự án. */
    issue_report: t.Optional(issueReportInputSchema),
});

export const approveCheckerBodySchema = t.Object({
    metadata: t.Unknown(),
});

export const rejectCheckerBodySchema = t.Object({
    notes: t.String({ minLength: 1 }),
    /** Field keys to reject (GROUP.FIELD or GROUP.*). When set, only editors whose allowedFields overlap are reopened. */
    reject_fields: t.Optional(t.Array(t.String({ minLength: 1 }))),
});

/** @deprecated Use rejectCheckerBodySchema */
export const rejectChecker1BodySchema = rejectCheckerBodySchema;

export const claimAssignmentSchema = t.Object({
    id: t.String(),
    dossierId: t.String(),
    role: workerRoleSchema,
    attemptNumber: t.Number(),
    status: assignmentStatusSchema,
    workQuality: t.Optional(t.Union([workQualitySchema, t.Null()])),
});

export const claimDossierSchema = t.Object({
    id: t.String(),
    name: t.String(),
    status: dossierStatusSchema,
    ocrMetadataKey: t.Union([t.String(), t.Null()]),
    rejectCount: t.Optional(t.Number()),
    lastRejectNotes: t.Optional(t.Union([t.String(), t.Null()])),
    isReturned: t.Optional(t.Boolean()),
    rejectedQcStep: t.Optional(t.Union([t.Number(), t.Null()])),
});

export const claimFileSchema = t.Object({
    id: t.String(),
    fileName: t.String(),
    fileUrl: t.String(),
    searchablePdfPath: t.Union([t.String(), t.Null()]),
    searchablePdfUrl: t.Union([t.String(), t.Null()]),
});

export const claimResponseSchema = t.Object({
    assignment: claimAssignmentSchema,
    dossier: claimDossierSchema,
    files: t.Array(claimFileSchema),
    currentMetadataUrl: t.Union([t.String(), t.Null()]),
    /** Filtered metadata inline when assignment has allowedFields; includes fields with null values. */
    currentMetadata: t.Optional(t.Union([t.Unknown(), t.Null()])),
    /** Field patterns this MAKER may read/write; null means full access via currentMetadataUrl. */
    allowedFields: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
    /** Fields rejected by QC that this MAKER must fix; null when not a selective reject. */
    rejectFields: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
    /** Thông báo vấn đề tài liệu từ biên tập (mỗi maker có thể gửi riêng). */
    issueReports: t.Optional(t.Array(issueReportResponseSchema)),
});

export type ClaimResponse = Static<typeof claimResponseSchema>;

export const draftMetadataResponseSchema = t.Object({
    dossierId: t.String(),
    assignmentId: t.String(),
    draftMetadataKey: t.String(),
    draftMetadataUrl: t.Union([t.String(), t.Null()]),
    assignmentStatus: assignmentStatusSchema,
    dossierStatus: dossierStatusSchema,
    savedAt: t.String(),
});

export const bulkSubmitDraftBodySchema = t.Object({
    items: t.Array(
        t.Object({
            dossierId: t.String({ format: "uuid" }),
            metadata: t.Unknown(),
            issue_report: t.Optional(issueReportInputSchema),
        }),
        { minItems: 1 },
    ),
});

export const bulkSubmitDraftItemResultSchema = t.Object({
    dossierId: t.String(),
    assignmentId: t.String(),
    role: workerRoleSchema,
    dossierStatus: dossierStatusSchema,
    metadataKey: t.String(),
    currentMetadataUrl: t.Optional(t.Union([t.String(), t.Null()])),
    partial: t.Optional(t.Boolean()),
    currentQcStep: t.Optional(t.Number()),
    approvedQcStep: t.Optional(t.Number()),
});

export const bulkSubmitDraftResponseSchema = t.Object({
    submitted: t.Array(bulkSubmitDraftItemResultSchema),
    failed: t.Array(t.Object({
        dossierId: t.String(),
        error: t.String(),
    })),
    submittedCount: t.Number(),
    failedCount: t.Number(),
});

export const submitResponseSchema = t.Object({
    dossierId: t.String(),
    assignmentId: t.String(),
    metadataKey: t.String(),
    dossierStatus: dossierStatusSchema,
    currentQcStep: t.Number(),
    approvedQcStep: t.Number(),
});

export const rejectResponseSchema = t.Object({
    dossierId: t.String(),
    assignmentId: t.String(),
    dossierStatus: dossierStatusSchema,
    rejectCount: t.Number(),
    rejectedQcStep: t.Number(),
    reopenedRoles: t.Array(workerRoleSchema),
    reopenedMakerCount: t.Number(),
    rejectFields: t.Union([t.Array(t.String()), t.Null()]),
});
