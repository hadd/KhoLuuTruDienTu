import { and, eq, sql } from "drizzle-orm";
import type { db } from "../db/db-conn.ts";
import { dossierAssignments } from "../db/schemas/dossier-assignment.ts";
import {
    AssignmentStatus,
    type WorkerRole as WorkerRoleType,
} from "../db/schemas/workflow-constants.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function hasInProgressAssignment(
    tx: DbTx,
    dossierId: string,
    role: WorkerRoleType,
) {
    const existing = await tx.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.role, role),
            eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
        ),
        columns: { id: true },
    });
    return existing != null;
}

/** Reset a REJECTED checker assignment so they can act again in a new QC cycle. */
export async function reopenRejectedCheckerAssignment(
    tx: DbTx,
    input: { dossierId: string; role: WorkerRoleType; now: Date },
) {
    await tx
        .update(dossierAssignments)
        .set({
            status: AssignmentStatus.IN_PROGRESS,
            attemptNumber: sql`${dossierAssignments.attemptNumber} + 1`,
            completedAt: null,
            assignedAt: input.now,
        })
        .where(and(
            eq(dossierAssignments.dossierId, input.dossierId),
            eq(dossierAssignments.role, input.role),
            eq(dossierAssignments.status, AssignmentStatus.REJECTED),
        ));
}
