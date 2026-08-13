import { and, eq, inArray } from "drizzle-orm";
import type { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import {
    AssignmentStatus,
    DossierStatus,
    QC_CHECKER_WORKFLOW,
    WORKABLE_ASSIGNMENT_STATUSES,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { activeDossierWhere } from "./active-query-filters.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function isQcInProgressStatus(status: string): boolean {
    return QC_CHECKER_WORKFLOW.some(
        (config) =>
            config.waiting === status ||
            config.processing === status ||
            config.rejected === status,
    );
}

export function extraCheckerRolesAfterCount(
    requiredQcCount: number,
): WorkerRoleType[] {
    return QC_CHECKER_WORKFLOW
        .filter((config) => config.step > requiredQcCount)
        .map((config) => config.role);
}

/** When reducing QC levels at/after the completed step, the dossier is done. */
export function shouldAutoApproveAfterQcCountChange(input: {
    status: string;
    currentQcStep: number;
    nextRequiredQcCount: number;
}): boolean {
    if (!isQcInProgressStatus(input.status)) return false;
    return input.currentQcStep >= input.nextRequiredQcCount;
}

async function cancelExtraCheckerAssignments(
    tx: DbTx,
    dossierId: string,
    extraRoles: WorkerRoleType[],
    now: Date,
) {
    if (extraRoles.length === 0) return;

    await tx
        .update(dossierAssignments)
        .set({
            status: AssignmentStatus.TRANSFERRED,
            completedAt: now,
        })
        .where(
            and(
                eq(dossierAssignments.dossierId, dossierId),
                inArray(
                    dossierAssignments.role,
                    extraRoles as [WorkerRoleType, ...WorkerRoleType[]],
                ),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            ),
        );
}

/**
 * After requiredQcCount changes: drop leftover CHECKER_N+ assignments and
 * auto-approve when enough QC steps are already complete.
 */
export async function reconcileDossierRequiredQcCount(
    tx: DbTx,
    input: {
        dossierId: string;
        status: string;
        currentQcStep: number;
        nextRequiredQcCount: number;
        actorId?: string | null;
    },
): Promise<{ status: string; currentQcStep: number }> {
    const now = new Date();
    const extraRoles = extraCheckerRolesAfterCount(input.nextRequiredQcCount);
    await cancelExtraCheckerAssignments(tx, input.dossierId, extraRoles, now);

    if (
        !shouldAutoApproveAfterQcCountChange({
            status: input.status,
            currentQcStep: input.currentQcStep,
            nextRequiredQcCount: input.nextRequiredQcCount,
        })
    ) {
        return {
            status: input.status,
            currentQcStep: input.currentQcStep,
        };
    }

    const nextQcStep = Math.min(input.currentQcStep, input.nextRequiredQcCount);

    await tx
        .update(dossiers)
        .set({
            status: DossierStatus.APPROVED,
            currentQcStep: nextQcStep,
            requiredQcCount: input.nextRequiredQcCount,
            updatedAt: now,
        })
        .where(activeDossierWhere(eq(dossiers.id, input.dossierId)));

    await tx.insert(workflowLogs).values({
        dossierId: input.dossierId,
        actorId: input.actorId ?? null,
        action: "AUTO_APPROVE",
        fromStatus: input.status as DossierStatus,
        toStatus: DossierStatus.APPROVED,
        notes: `requiredQcCount reduced to ${input.nextRequiredQcCount}; currentQcStep=${input.currentQcStep}`,
    });

    return {
        status: DossierStatus.APPROVED,
        currentQcStep: nextQcStep,
    };
}
