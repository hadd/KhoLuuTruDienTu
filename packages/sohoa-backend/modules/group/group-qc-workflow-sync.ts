import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import {
    AssignmentStatus,
    DossierStatus,
    QC_CHECKER_BY_STEP,
    WORKABLE_ASSIGNMENT_STATUSES,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import {
    checkerRoleForStep,
    type QcWorkflowConfig,
} from "./group-qc-config.ts";
import { getCurrentAttemptNumber } from "../../libs/workflow-assignment-utils.ts";
import { scheduleDossierAssignedNotification } from "../notification/notification-delivery-service.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const PRESERVE_STATUSES = new Set<DossierStatus>([
    DossierStatus.APPROVED,
    DossierStatus.READY_FOR_ENTRY,
    DossierStatus.ENTRY_PROCESSING,
    DossierStatus.NEW,
    DossierStatus.OCR_PROCESSING,
    DossierStatus.OCR_FAILED,
]);

function isQcSyncEligible(status: string): boolean {
    return status !== DossierStatus.APPROVED;
}

export type SyncQcWorkflowResult = {
    dossiersAffected: number;
    levelsActivated: number;
    assignmentsTransferred: number;
    assignmentsCreated: number;
    statusUpdated: number;
    perStep: Array<{
        step: number;
        peers: string[];
        distribution: Record<string, { completed: number; inProgress: number }>;
    }>;
};

async function transferAssignment(
    tx: DbTx,
    input: {
        assignmentId: string;
        dossierId: string;
        role: WorkerRoleType;
        newAssigneeId: string;
        stepNumber: number;
        actorId: string;
        dossierStatus: DossierStatus;
        now: Date;
    },
) {
    const existing = await tx.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.id, input.assignmentId),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
        ),
        columns: { id: true, attemptNumber: true },
    });

    if (!existing) {
        return;
    }

    await tx
        .update(dossierAssignments)
        .set({
            status: AssignmentStatus.TRANSFERRED,
            completedAt: input.now,
        })
        .where(eq(dossierAssignments.id, existing.id));

    await tx.insert(dossierAssignments).values({
        dossierId: input.dossierId,
        role: input.role,
        assigneeId: input.newAssigneeId,
        attemptNumber: existing.attemptNumber,
        stepNumber: input.stepNumber,
        status: AssignmentStatus.IN_PROGRESS,
        assignedAt: input.now,
    });
}

async function createCheckerAssignment(
    tx: DbTx,
    input: {
        dossierId: string;
        role: WorkerRoleType;
        assigneeId: string;
        stepNumber: number;
        actorId: string;
        dossierStatus: DossierStatus;
        now: Date;
    },
) {
    const attemptNumber = await getCurrentAttemptNumber(
        tx,
        input.dossierId,
        input.role,
    );

    await tx.insert(dossierAssignments).values({
        dossierId: input.dossierId,
        role: input.role,
        assigneeId: input.assigneeId,
        attemptNumber,
        stepNumber: input.stepNumber,
        status: AssignmentStatus.IN_PROGRESS,
        assignedAt: input.now,
    });

    await tx.insert(workflowLogs).values({
        dossierId: input.dossierId,
        actorId: input.actorId,
        action: `ASSIGN_${input.role}`,
        fromStatus: input.dossierStatus,
        toStatus: input.dossierStatus,
        notes: `Sync assigned to ${input.assigneeId}`,
    });
}

function resolveExpectedWaitingStatus(currentQcStep: number, roundNumber: number): DossierStatus | null {
    if (currentQcStep >= roundNumber) {
        return DossierStatus.APPROVED;
    }

    const nextStep = currentQcStep + 1;
    const config = QC_CHECKER_BY_STEP.get(nextStep);
    return config?.waiting ?? null;
}

function distributeEvenly(dossierIds: string[], peers: string[]): Map<string, string> {
    const result = new Map<string, string>();
    for (let i = 0; i < dossierIds.length; i++) {
        result.set(dossierIds[i]!, peers[i % peers.length]!);
    }
    return result;
}

export async function syncGroupQcWorkflow(input: {
    groupId: string;
    actorId: string;
    previousConfig: QcWorkflowConfig;
    nextConfig: QcWorkflowConfig;
    scope?: { folderId?: string; dossierIds?: string[] };
}): Promise<SyncQcWorkflowResult> {
    const dossierConditions = [
        activeDossierWhere(eq(dossiers.assignedGroupId, input.groupId)),
    ];

    let scopedDossierIds = input.scope?.dossierIds;

    if (input.scope?.folderId) {
        const folderDossiers = await db.query.dossiers.findMany({
            where: activeDossierWhere(
                eq(dossiers.assignedGroupId, input.groupId),
                eq(dossiers.folderId, input.scope.folderId),
            ),
            columns: { id: true },
        });
        scopedDossierIds = folderDossiers.map((row) => row.id);
    }

    const dossierRows = scopedDossierIds && scopedDossierIds.length > 0
        ? await db.query.dossiers.findMany({
            where: activeDossierWhere(
                eq(dossiers.assignedGroupId, input.groupId),
                inArray(dossiers.id, scopedDossierIds),
            ),
        })
        : await db.query.dossiers.findMany({
            where: and(...dossierConditions),
        });

    if (dossierRows.length === 0) {
        return {
            dossiersAffected: 0,
            levelsActivated: 0,
            assignmentsTransferred: 0,
            assignmentsCreated: 0,
            statusUpdated: 0,
            perStep: [],
        };
    }

    const dossierIds = dossierRows.map((row) => row.id);
    const syncEligibleDossierIds = dossierRows
        .filter((row) => isQcSyncEligible(row.status))
        .map((row) => row.id);
    const stats: SyncQcWorkflowResult = {
        dossiersAffected: dossierRows.length,
        levelsActivated: 0,
        assignmentsTransferred: 0,
        assignmentsCreated: 0,
        statusUpdated: 0,
        perStep: [],
    };
    const assignmentNotifications: Array<{
        dossierId: string;
        assigneeId: string;
        workerRole: WorkerRoleType;
        dossierName: string;
        folderId: string;
    }> = [];

    const allAssignments = await db.query.dossierAssignments.findMany({
        where: inArray(dossierAssignments.dossierId, dossierIds),
    });

    const assignmentsByDossier = new Map<string, typeof allAssignments>();
    for (const row of allAssignments) {
        const list = assignmentsByDossier.get(row.dossierId) ?? [];
        list.push(row);
        assignmentsByDossier.set(row.dossierId, list);
    }

    await db.transaction(async (tx) => {
        const now = new Date();

        if (syncEligibleDossierIds.length > 0) {
            await tx
                .update(dossiers)
                .set({
                    requiredQcCount: input.nextConfig.roundNumber,
                    updatedAt: now,
                })
                .where(activeDossierWhere(inArray(dossiers.id, syncEligibleDossierIds)));
        }

        for (let step = 1; step <= input.nextConfig.roundNumber; step++) {
            const peers = input.nextConfig.qcPeersByStep.get(step) ?? [];
            if (peers.length === 0) {
                continue;
            }

            const checkerConfig = checkerRoleForStep(step);
            const distribution: Record<string, { completed: number; inProgress: number }> = {};
            for (const peerId of peers) {
                distribution[peerId] = { completed: 0, inProgress: 0 };
            }

            const rebalanceDossierIds: string[] = [];

            for (const dossier of dossierRows) {
                if (!isQcSyncEligible(dossier.status)) {
                    continue;
                }

                const rows = assignmentsByDossier.get(dossier.id) ?? [];
                const completed = rows.find(
                    (row) => row.role === checkerConfig.role
                        && row.status === AssignmentStatus.COMPLETED,
                );
                const inProgress = rows.find(
                    (row) => row.role === checkerConfig.role
                        && (row.status === AssignmentStatus.IN_PROGRESS
                            || row.status === AssignmentStatus.DRAFT),
                );

                if (completed) {
                    const bucket = distribution[completed.assigneeId];
                    if (bucket) {
                        bucket.completed += 1;
                    }
                    continue;
                }

                if (dossier.currentQcStep >= step) {
                    continue;
                }

                if (inProgress) {
                    rebalanceDossierIds.push(dossier.id);
                    continue;
                }

                rebalanceDossierIds.push(dossier.id);
            }

            rebalanceDossierIds.sort();
            const targets = distributeEvenly(rebalanceDossierIds, peers);

            for (const dossierId of rebalanceDossierIds) {
                const dossier = dossierRows.find((row) => row.id === dossierId)!;
                const targetPeer = targets.get(dossierId)!;
                const inProgress = await tx.query.dossierAssignments.findFirst({
                    where: and(
                        eq(dossierAssignments.dossierId, dossierId),
                        eq(dossierAssignments.role, checkerConfig.role),
                        inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
                    ),
                });

                if (inProgress) {
                    if (inProgress.assigneeId === targetPeer) {
                        distribution[targetPeer]!.inProgress += 1;
                        continue;
                    }

                    await transferAssignment(tx, {
                        assignmentId: inProgress.id,
                        dossierId,
                        role: checkerConfig.role,
                        newAssigneeId: targetPeer,
                        stepNumber: step,
                        actorId: input.actorId,
                        dossierStatus: dossier.status as DossierStatus,
                        now,
                    });
                    assignmentNotifications.push({
                        dossierId,
                        assigneeId: targetPeer,
                        workerRole: checkerConfig.role,
                        dossierName: dossier.name,
                        folderId: dossier.folderId,
                    });
                    stats.assignmentsTransferred += 1;
                    distribution[targetPeer]!.inProgress += 1;
                    continue;
                }

                await createCheckerAssignment(tx, {
                    dossierId,
                    role: checkerConfig.role,
                    assigneeId: targetPeer,
                    stepNumber: step,
                    actorId: input.actorId,
                    dossierStatus: dossier.status as DossierStatus,
                    now,
                });
                assignmentNotifications.push({
                    dossierId,
                    assigneeId: targetPeer,
                    workerRole: checkerConfig.role,
                    dossierName: dossier.name,
                    folderId: dossier.folderId,
                });
                stats.assignmentsCreated += 1;
                distribution[targetPeer]!.inProgress += 1;
            }

            stats.perStep.push({ step, peers, distribution });
        }

        const refreshedDossiers = await tx.query.dossiers.findMany({
            where: activeDossierWhere(inArray(dossiers.id, dossierIds)),
        });

        for (const dossier of refreshedDossiers) {
            if (PRESERVE_STATUSES.has(dossier.status as DossierStatus)) {
                continue;
            }

            const expected = resolveExpectedWaitingStatus(
                dossier.currentQcStep,
                input.nextConfig.roundNumber,
            );

            if (!expected || dossier.status === expected) {
                continue;
            }

            await tx
                .update(dossiers)
                .set({
                    status: expected,
                    updatedAt: now,
                })
                .where(activeDossierWhere(eq(dossiers.id, dossier.id)));

            await tx.insert(workflowLogs).values({
                dossierId: dossier.id,
                actorId: input.actorId,
                action: "SYNC_QC_WORKFLOW",
                fromStatus: dossier.status as DossierStatus,
                toStatus: expected,
                notes: `group=${input.groupId}`,
            });

            stats.statusUpdated += 1;
        }
    });

    for (const notification of assignmentNotifications) {
        scheduleDossierAssignedNotification(notification);
    }

    return stats;
}
