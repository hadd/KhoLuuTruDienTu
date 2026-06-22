import { and, eq, inArray, sql } from "drizzle-orm";
import type { db } from "../db/db-conn.ts";
import { dossierAssignments } from "../db/schemas/dossier-assignment.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { workflowLogs } from "../db/schemas/workflow-log.ts";
import {
    AssignmentStatus,
    DossierStatus,
    WorkerRole,
    type WorkerRole as WorkerRoleType,
} from "../db/schemas/workflow-constants.ts";
import { activeDossierWhere } from "../modules/dossier/active-query-filters.ts";

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

/**
 * Lấy attempt hiện tại của dossier+role (max trên các dòng phân công).
 * Dùng khi tạo phân công mới / phân công lại — không tăng như vòng reject.
 */
export async function getCurrentAttemptNumber(
    tx: DbTx,
    dossierId: string,
    role: WorkerRoleType,
): Promise<number> {
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

    return Math.max(...existing.map((row) => row.attemptNumber));
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

/**
 * Hủy các phân công IN_PROGRESS để phân lại (chưa COMPLETED).
 * Trả về số assignment đã chuyển sang TRANSFERRED.
 */
export async function cancelInProgressAssignmentsForReassign(
    tx: DbTx,
    input: {
        dossierId: string;
        actorId: string;
        dossierStatus: string;
        now: Date;
        roles?: WorkerRoleType[];
        notes?: string;
    },
): Promise<number> {
    const roleFilter = input.roles && input.roles.length > 0
        ? inArray(dossierAssignments.role, input.roles as [WorkerRoleType, ...WorkerRoleType[]])
        : undefined;

    const rows = await tx.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.dossierId, input.dossierId),
            eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
            ...(roleFilter ? [roleFilter] : []),
        ),
        columns: { id: true },
    });

    if (rows.length === 0) {
        return 0;
    }

    await tx
        .update(dossierAssignments)
        .set({
            status: AssignmentStatus.TRANSFERRED,
            completedAt: input.now,
        })
        .where(and(
            eq(dossierAssignments.dossierId, input.dossierId),
            eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
            ...(roleFilter ? [roleFilter] : []),
        ));

    await tx.insert(workflowLogs).values({
        dossierId: input.dossierId,
        actorId: input.actorId,
        action: "REASSIGN_CANCEL_IN_PROGRESS",
        fromStatus: input.dossierStatus as DossierStatus,
        toStatus: input.dossierStatus as DossierStatus,
        notes: input.notes ?? `Cancelled ${rows.length} in-progress assignment(s) for reassignment`,
    });

    return rows.length;
}

/** Đưa hồ sơ về READY_FOR_ENTRY sau khi hủy phân công biên tập (chưa hoàn thành entry). */
export async function resetDossierEntryStatusAfterMakerReassign(
    tx: DbTx,
    dossierId: string,
) {
    const dossier = await tx.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
        columns: { id: true, status: true },
    });
    if (!dossier) {
        return;
    }

    const activeMaker = await tx.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.role, WorkerRole.MAKER),
            eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
        ),
        columns: { id: true },
    });

    if (activeMaker) {
        return;
    }

    if (dossier.status === DossierStatus.ENTRY_PROCESSING) {
        await tx
            .update(dossiers)
            .set({
                status: DossierStatus.READY_FOR_ENTRY,
                updatedAt: new Date(),
            })
            .where(eq(dossiers.id, dossierId));
    }
}
