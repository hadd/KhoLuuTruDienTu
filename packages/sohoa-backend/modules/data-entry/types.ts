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
    assignmentId: t.String(),
    dossierStatus: dossierStatusSchema,
    rejectCount: t.Number(),
});
