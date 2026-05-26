import { httpError } from "@shared/common-lib";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import {
    AssignmentStatus,
    DossierStatus,
    WorkerRole,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import {
    buildLinkGet,
    buildWorkerMetadataKey,
    uploadJsonToStorage,
} from "./data-entry-s3-utils.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const WORKFLOW_ACTION = {
    CLAIM_ENTRY: "CLAIM_ENTRY",
    SUBMIT_ENTRY: "SUBMIT_ENTRY",
    CLAIM_CHECKER_1: "CLAIM_CHECKER_1",
    APPROVE_CHECKER_1: "APPROVE_CHECKER_1",
    REJECT_CHECKER_1: "REJECT_CHECKER_1",
} as const;

const makerGetPriority = sql`CASE
    WHEN ${dossiers.status} = ${DossierStatus.ENTRY_PROCESSING} THEN 0
    WHEN ${dossiers.status} = ${DossierStatus.CHECKER_1_REJECTED} THEN 1
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

async function submitMetadata(input: {
    assignmentId: string;
    actorId: string;
    role: WorkerRoleType;
    nextDossierStatus: string;
    workflowAction: string;
    metadata: unknown;
}) {
    const assignment = await loadAssignmentForActor(
        input.assignmentId,
        input.actorId,
        input.role,
    );

    const dossier = assignment.dossier;
    if (!dossier.ocrMetadataKey) {
        throw httpError.badRequest("Dossier has no OCR metadata key");
    }

    const metadataKey = buildWorkerMetadataKey(dossier.ocrMetadataKey, input.role);
    const storedKey = await uploadJsonToStorage(metadataKey, input.metadata);

    const [updatedDossier] = await db.transaction(async (tx) => {
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
                status: input.nextDossierStatus,
                currentMetadataKey: storedKey,
                updatedAt: new Date(),
            })
            .where(eq(dossiers.id, dossier.id))
            .returning();

        await insertWorkflowLog(tx, {
            dossierId: dossier.id,
            actorId: input.actorId,
            action: input.workflowAction,
            fromStatus: dossier.status,
            toStatus: input.nextDossierStatus,
        });

        return dossierRow;
    });

    return {
        assignmentId: assignment.id,
        metadataKey: storedKey,
        dossierStatus: updatedDossier.status,
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
                        DossierStatus.CHECKER_1_REJECTED,
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
                        DossierStatus.CHECKER_1_REJECTED,
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

    async submitMaker(assignmentId: string, actorId: string, metadata: unknown) {
        return await submitMetadata({
            assignmentId,
            actorId,
            role: WorkerRole.MAKER,
            nextDossierStatus: DossierStatus.WAITING_CHECKER_1,
            workflowAction: WORKFLOW_ACTION.SUBMIT_ENTRY,
            metadata,
        });
    },

    async claimChecker1(assigneeId: string) {
        return await claimDossier({
            role: WorkerRole.CHECKER_1,
            assigneeId,
            allowedStatuses: [DossierStatus.WAITING_CHECKER_1],
            processingStatus: DossierStatus.CHECKER_1_PROCESSING,
            workflowAction: WORKFLOW_ACTION.CLAIM_CHECKER_1,
        });
    },

    async approveChecker1(assignmentId: string, actorId: string, metadata: unknown) {
        return await submitMetadata({
            assignmentId,
            actorId,
            role: WorkerRole.CHECKER_1,
            nextDossierStatus: DossierStatus.WAITING_CHECKER_2,
            workflowAction: WORKFLOW_ACTION.APPROVE_CHECKER_1,
            metadata,
        });
    },

    async rejectChecker1(assignmentId: string, actorId: string, notes: string) {
        const assignment = await loadAssignmentForActor(
            assignmentId,
            actorId,
            WorkerRole.CHECKER_1,
        );

        const dossier = assignment.dossier;

        const [updatedDossier] = await db.transaction(async (tx) => {
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
                    status: DossierStatus.CHECKER_1_REJECTED,
                    rejectCount: dossier.rejectCount + 1,
                    lastRejectNotes: notes,
                    updatedAt: new Date(),
                })
                .where(eq(dossiers.id, dossier.id))
                .returning();

            await insertWorkflowLog(tx, {
                dossierId: dossier.id,
                actorId,
                action: WORKFLOW_ACTION.REJECT_CHECKER_1,
                fromStatus: dossier.status,
                toStatus: DossierStatus.CHECKER_1_REJECTED,
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
