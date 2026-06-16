import { t } from "elysia";
import { dossierStatusSchema, workerRoleSchema } from "../../db/schemas/workflow-constants.ts";

export const submitMetadataBodySchema = t.Object({
    metadata: t.Unknown(),
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
});

export const claimDossierSchema = t.Object({
    id: t.String(),
    name: t.String(),
    status: dossierStatusSchema,
    ocrMetadataKey: t.Union([t.String(), t.Null()]),
});

export const claimFileSchema = t.Object({
    id: t.String(),
    fileName: t.String(),
    fileUrl: t.String(),
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
