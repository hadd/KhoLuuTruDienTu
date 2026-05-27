import { httpError } from "@shared/common-lib";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import {
    AssignmentStatus,
    CHECKER_REJECTED_STATUSES,
    DossierStatus,
    QC_CHECKER_WORKFLOW,
    WorkerRole,
    type DossierStatus as DossierStatusType,
    type QcCheckerWorkflowStep,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import {
    buildLinkGet,
    buildCuratedMetadataUpdateKey,
    uploadJsonToStorage,
} from "./data-entry-s3-utils.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const WORKFLOW_ACTION = {
    CLAIM_ENTRY: "CLAIM_ENTRY",
    SUBMIT_ENTRY: "SUBMIT_ENTRY",
} as const;

const QC_CHECKER_BY_ROLE = new Map<WorkerRoleType, QcCheckerWorkflowStep>(
    QC_CHECKER_WORKFLOW.map((config) => [config.role, config]),
);

const QC_CHECKER_BY_STEP = new Map<number, QcCheckerWorkflowStep>(
    QC_CHECKER_WORKFLOW.map((config) => [config.step, config]),
);

function checkerWorkflowAction(prefix: "CLAIM" | "APPROVE" | "REJECT", step: number): string {
    return `${prefix}_CHECKER_${step}`;
}

function getCheckerConfig(role: WorkerRoleType): QcCheckerWorkflowStep {
    const config = QC_CHECKER_BY_ROLE.get(role);
    if (!config) {
        throw httpError.badRequest("Role cannot perform QC on metadata");
    }
    return config;
}

function getCheckerConfigForCurrentQcStep(currentQcStep: number): QcCheckerWorkflowStep {
    const config = QC_CHECKER_BY_STEP.get(currentQcStep + 1);
    if (!config) {
        throw httpError.conflict(
            `Dossier at QC step ${currentQcStep} has no pending checker approval`,
        );
    }
    return config;
}

function getWaitingStatusAfterQcStep(completedQcStep: number): DossierStatusType | null {
    const nextChecker = QC_CHECKER_BY_STEP.get(completedQcStep + 1);
    return nextChecker?.waiting ?? null;
}

function resolveNextAfterQcApprove(dossier: {
    currentQcStep: number;
    requiredQcCount: number;
}): { nextQcStep: number; nextStatus: DossierStatusType } {
    const nextQcStep = dossier.currentQcStep + 1;

    if (nextQcStep >= dossier.requiredQcCount) {
        return { nextQcStep, nextStatus: DossierStatus.APPROVED };
    }

    const nextStatus = getWaitingStatusAfterQcStep(nextQcStep);
    if (!nextStatus) {
        throw httpError.internalServerError(
            `No dossier status configured for QC step ${nextQcStep}`,
        );
    }

    return { nextQcStep, nextStatus };
}

const makerGetPriority = sql`CASE
    WHEN ${dossiers.status} = ${DossierStatus.ENTRY_PROCESSING} THEN 0
    WHEN ${inArray(dossiers.status, CHECKER_REJECTED_STATUSES)} THEN 1
    WHEN ${dossiers.status} = ${DossierStatus.READY_FOR_ENTRY} THEN 2
    ELSE 3
END`;

async function insertWorkflowLog(
    tx: DbTx,
    input: {
        dossierId: string;
        actorId: string;
        action: string;
        fromStatus: string | null;
        toStatus: string | null;
        notes?: string | null;
    },
) {
    await tx.insert(workflowLogs).values({
        dossierId: input.dossierId,
        actorId: input.actorId,
        action: input.action,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        notes: input.notes ?? null,
    });
}

async function getNextAttemptNumber(tx: DbTx, dossierId: string, role: WorkerRoleType) {
    const existing = await tx.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.role, role),
        ),
        columns: { attemptNumber: true },
    });

    if (existing.length === 0) {
        return 1;
    }

    return Math.max(...existing.map((a) => a.attemptNumber)) + 1;
}

async function buildClaimPayload(
    assignment: {
        id: string;
        dossierId: string;
        role: WorkerRoleType;
        attemptNumber: number;
    },
    dossier: {
        id: string;
        name: string;
        status: string;
        ocrMetadataKey: string | null;
        currentMetadataKey: string | null;
    },
) {
    const files = await db.query.dossierFiles.findMany({
        where: eq(dossierFiles.dossierId, dossier.id),
        orderBy: asc(dossierFiles.fileName),
    });

    const filesWithUrls = await Promise.all(
        files.map(async (file) => ({
            id: file.id,
            fileName: file.fileName,
            fileUrl: (await buildLinkGet(file.filePath)) ?? "",
        })),
    );
// Thêm json
    const rawMetadataKey = dossier.currentMetadataKey;
    const metadataKeyJson = rawMetadataKey && !rawMetadataKey.endsWith(".json")
        ? `${rawMetadataKey}.json`
        : rawMetadataKey;
    const currentMetadataUrl = await buildLinkGet(metadataKeyJson);

    return {
        assignment: {
            id: assignment.id,
            dossierId: assignment.dossierId,
            role: assignment.role,
            attemptNumber: assignment.attemptNumber,
        },
        dossier: {
            id: dossier.id,
            name: dossier.name,
            status: dossier.status,
            ocrMetadataKey: dossier.ocrMetadataKey,
        },
        files: filesWithUrls,
        currentMetadataUrl,
    };
}

async function findActiveAssignment(assigneeId: string, role: WorkerRoleType) {
    return await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.assigneeId, assigneeId),
            eq(dossierAssignments.role, role),
            eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
        ),
        with: { dossier: true },
        orderBy: asc(dossierAssignments.assignedAt),
    });
}

async function claimDossier(input: {
    role: WorkerRoleType;
    assigneeId: string;
    allowedStatuses: string[];
    processingStatus: string;
    priorityOrder?: ReturnType<typeof sql>;
    workflowAction: string;
}) {
    const existing = await findActiveAssignment(input.assigneeId, input.role);
    if (existing?.dossier) {
        return await buildClaimPayload(existing, existing.dossier);
    }

    const result = await db.transaction(async (tx) => {
        const orderBy = input.priorityOrder
            ? [input.priorityOrder, asc(dossiers.updatedAt)]
            : [asc(dossiers.updatedAt)];

        const [candidate] = await tx
            .select()
            .from(dossiers)
            .where(inArray(dossiers.status, input.allowedStatuses))
            .orderBy(...orderBy)
            .limit(1)
            .for("update", { skipLocked: true });

        if (!candidate) {
            return null;
        }

        const [updated] = await tx
            .update(dossiers)
            .set({
                status: input.processingStatus,
                updatedAt: new Date(),
            })
            .where(and(
                eq(dossiers.id, candidate.id),
                inArray(dossiers.status, input.allowedStatuses),
            ))
            .returning();

        if (!updated) {
            return null;
        }

        const attemptNumber = await getNextAttemptNumber(tx, updated.id, input.role);

        const [assignment] = await tx
            .insert(dossierAssignments)
            .values({
                dossierId: updated.id,
                role: input.role,
                assigneeId: input.assigneeId,
                attemptNumber,
                stepNumber: updated.currentQcStep + 1,
                status: AssignmentStatus.IN_PROGRESS,
            })
            .returning();

        await insertWorkflowLog(tx, {
            dossierId: updated.id,
            actorId: input.assigneeId,
            action: input.workflowAction,
            fromStatus: candidate.status,
            toStatus: input.processingStatus,
        });

        return { assignment, dossier: updated };
    });

    if (!result) {
        throw httpError.notFound("No dossier available to claim");
    }

    return await buildClaimPayload(result.assignment, result.dossier);
}

async function loadAssignmentForActor(assignmentId: string, actorId: string, role: WorkerRoleType) {
    const assignment = await db.query.dossierAssignments.findFirst({
        where: eq(dossierAssignments.id, assignmentId),
        with: { dossier: true },
    });

    if (!assignment) {
        throw httpError.notFound("Assignment not found");
    }

    if (assignment.assigneeId !== actorId) {
        throw httpError.forbidden("Assignment does not belong to you");
    }

    if (assignment.role !== role) {
        throw httpError.forbidden("Invalid role for this assignment");
    }

    if (assignment.status !== AssignmentStatus.IN_PROGRESS) {
        throw httpError.conflict("Assignment is not in progress");
    }

    if (!assignment.dossier) {
        throw httpError.notFound("Dossier not found");
    }

    return assignment;
}

async function loadAssignmentForActorByDossier(
    dossierId: string,
    actorId: string,
    role: WorkerRoleType,
) {
    const assignment = await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.assigneeId, actorId),
            eq(dossierAssignments.role, role),
            eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
        ),
        with: { dossier: true },
    });

    if (!assignment?.dossier) {
        throw httpError.notFound("No in-progress assignment found for this dossier");
    }

    return assignment;
}

async function approveMetadata(input: {
    dossierId: string;
    actorId: string;
    role: WorkerRoleType;
    metadata: unknown;
    workflowAction?: string;
}) {
    const assignment = await loadAssignmentForActorByDossier(
        input.dossierId,
        input.actorId,
        input.role,
    );

    const dossier = assignment.dossier;
    const checkerConfig = getCheckerConfig(input.role);

    if (dossier.currentQcStep + 1 !== checkerConfig.step) {
        throw httpError.conflict(
            `Dossier is at QC step ${dossier.currentQcStep}, cannot approve as ${input.role}`,
        );
    }

    if (!dossier.ocrMetadataKey) {
        throw httpError.badRequest("Dossier has no OCR metadata key");
    }

    const { nextQcStep, nextStatus } = resolveNextAfterQcApprove(dossier);
    const workflowAction = input.workflowAction
        ?? checkerWorkflowAction("APPROVE", checkerConfig.step);

    const metadataKey = buildCuratedMetadataUpdateKey(dossier.ocrMetadataKey, input.role);
    const storedKey = await uploadJsonToStorage(metadataKey, input.metadata);

    const updatedDossier = await db.transaction(async (tx) => {
        const [assignmentRow] = await tx
            .update(dossierAssignments)
            .set({
                metadataKey: storedKey,
                status: AssignmentStatus.COMPLETED,
                completedAt: new Date(),
            })
            .where(and(
                eq(dossierAssignments.id, assignment.id),
                eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
            ))
            .returning();

        if (!assignmentRow) {
            throw httpError.conflict("Assignment is no longer in progress");
        }

        const [dossierRow] = await tx
            .update(dossiers)
            .set({
                status: nextStatus,
                currentQcStep: nextQcStep,
                currentMetadataKey: storedKey,
                updatedAt: new Date(),
            })
            .where(eq(dossiers.id, dossier.id))
            .returning();

        if (!dossierRow) {
            throw httpError.notFound("Dossier not found");
        }

        await insertWorkflowLog(tx, {
            dossierId: dossier.id,
            actorId: input.actorId,
            action: workflowAction,
            fromStatus: dossier.status,
            toStatus: nextStatus,
        });

        return dossierRow;
    });

    return {
        dossierId: dossier.id,
        assignmentId: assignment.id,
        metadataKey: storedKey,
        dossierStatus: updatedDossier.status,
        currentQcStep: updatedDossier.currentQcStep,
        approvedQcStep: checkerConfig.step,
    };
}

export const DataEntryService = {
    async getMakerAssignment(assigneeId: string) {
        const result = await db.transaction(async (tx) => {
            const [row] = await tx
                .select({
                    assignment: dossierAssignments,
                    dossier: dossiers,
                })
                .from(dossierAssignments)
                .innerJoin(dossiers, eq(dossierAssignments.dossierId, dossiers.id))
                .where(and(
                    eq(dossierAssignments.assigneeId, assigneeId),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                    inArray(dossiers.status, [
                        DossierStatus.ENTRY_PROCESSING,
                        ...CHECKER_REJECTED_STATUSES,
                        DossierStatus.READY_FOR_ENTRY,
                    ]),
                ))
                .orderBy(makerGetPriority, asc(dossiers.updatedAt))
                .limit(1)
                .for("update", { skipLocked: true });

            if (!row) {
                return null;
            }

            if (row.dossier.status === DossierStatus.ENTRY_PROCESSING) {
                return row;
            }

            const fromStatus = row.dossier.status;

            const [updatedDossier] = await tx
                .update(dossiers)
                .set({
                    status: DossierStatus.ENTRY_PROCESSING,
                    updatedAt: new Date(),
                })
                .where(and(
                    eq(dossiers.id, row.dossier.id),
                    inArray(dossiers.status, [
                        ...CHECKER_REJECTED_STATUSES,
                        DossierStatus.READY_FOR_ENTRY,
                    ]),
                ))
                .returning();

            if (!updatedDossier) {
                return row;
            }

            await insertWorkflowLog(tx, {
                dossierId: updatedDossier.id,
                actorId: assigneeId,
                action: WORKFLOW_ACTION.CLAIM_ENTRY,
                fromStatus,
                toStatus: DossierStatus.ENTRY_PROCESSING,
            });

            return { assignment: row.assignment, dossier: updatedDossier };
        });

        if (!result) {
            throw httpError.notFound("No assigned dossier found");
        }

        return await buildClaimPayload(result.assignment, result.dossier);
    },

    async claimChecker(assigneeId: string, role: WorkerRoleType) {
        const config = getCheckerConfig(role);
        return await claimDossier({
            role: config.role,
            assigneeId,
            allowedStatuses: [config.waiting],
            processingStatus: config.processing,
            workflowAction: checkerWorkflowAction("CLAIM", config.step),
        });
    },

    async approveCheckerByDossier(dossierId: string, actorId: string, metadata: unknown) {
        const dossier = await db.query.dossiers.findFirst({
            where: eq(dossiers.id, dossierId),
            columns: { currentQcStep: true },
        });

        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }

        const config = getCheckerConfigForCurrentQcStep(dossier.currentQcStep);
        return await approveMetadata({
            dossierId,
            actorId,
            role: config.role,
            metadata,
            workflowAction: checkerWorkflowAction("APPROVE", config.step),
        });
    },

    async rejectChecker(assignmentId: string, actorId: string, role: WorkerRoleType, notes: string) {
        const config = getCheckerConfig(role);
        const assignment = await loadAssignmentForActor(assignmentId, actorId, config.role);
        const dossier = assignment.dossier;

        const updatedDossier = await db.transaction(async (tx) => {
            const [assignmentRow] = await tx
                .update(dossierAssignments)
                .set({
                    status: AssignmentStatus.REJECTED,
                    completedAt: new Date(),
                })
                .where(and(
                    eq(dossierAssignments.id, assignment.id),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ))
                .returning();

            if (!assignmentRow) {
                throw httpError.conflict("Assignment is no longer in progress");
            }

            const [dossierRow] = await tx
                .update(dossiers)
                .set({
                    status: config.rejected,
                    rejectCount: dossier.rejectCount + 1,
                    lastRejectNotes: notes,
                    updatedAt: new Date(),
                })
                .where(eq(dossiers.id, dossier.id))
                .returning();

            if (!dossierRow) {
                throw httpError.notFound("Dossier not found");
            }

            await insertWorkflowLog(tx, {
                dossierId: dossier.id,
                actorId,
                action: checkerWorkflowAction("REJECT", config.step),
                fromStatus: dossier.status,
                toStatus: config.rejected,
                notes,
            });

            return dossierRow;
        });

        return {
            assignmentId: assignment.id,
            dossierStatus: updatedDossier.status,
            rejectCount: updatedDossier.rejectCount,
        };
    },
};
