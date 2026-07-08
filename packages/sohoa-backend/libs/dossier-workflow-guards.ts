import { httpError } from "@shared/common-lib";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { db } from "../db/db-conn.ts";
import { dossierAssignments } from "../db/schemas/dossier-assignment.ts";
import {
    AssignmentStatus,
    WORKABLE_ASSIGNMENT_STATUSES,
    WorkerRole,
    type DossierStatus as DossierStatusType,
    type QcCheckerWorkflowStep,
} from "../db/schemas/workflow-constants.ts";
import {
    buildActiveMakerIndex,
    buildCompletedMakerIndex,
    isDossierMakerEntryComplete,
} from "../modules/group/group-assignment-guards.ts";

type DbConn = typeof db;
type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type MakerCompletionState = {
    isComplete: boolean;
    hasActive: boolean;
    activeCount: number;
    completedCount: number;
};

export async function loadMakerCompletionState(
    conn: DbConn | DbTx,
    dossierId: string,
): Promise<MakerCompletionState> {
    const makers = await conn.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.role, WorkerRole.MAKER),
            ne(dossierAssignments.status, AssignmentStatus.TRANSFERRED),
        ),
        columns: { assigneeId: true, status: true },
    });

    const active = makers.filter((row) =>
        (WORKABLE_ASSIGNMENT_STATUSES as readonly string[]).includes(row.status)
    );
    const completed = makers.filter((row) => row.status === AssignmentStatus.COMPLETED);

    const activeMakerIndex = buildActiveMakerIndex(
        active.map((row) => ({ dossierId, assigneeId: row.assigneeId })),
    );
    const completedMakerIndex = buildCompletedMakerIndex(
        completed.map((row) => ({ dossierId, assigneeId: row.assigneeId })),
    );

    return {
        isComplete: isDossierMakerEntryComplete(dossierId, activeMakerIndex, completedMakerIndex),
        hasActive: active.length > 0,
        activeCount: active.length,
        completedCount: completed.length,
    };
}

export function assertMakerEntryComplete(state: MakerCompletionState): void {
    if (!state.isComplete) {
        throw httpError.conflict(
            "Hồ sơ chưa hoàn thành biên tập — còn biên tập viên chưa gửi cuối",
        );
    }
}

export function assertDossierStatusAllowsCheckerAction(
    dossierStatus: DossierStatusType,
    checkerConfig: QcCheckerWorkflowStep,
): void {
    const allowed = [checkerConfig.waiting, checkerConfig.processing] as readonly string[];
    if (!allowed.includes(dossierStatus)) {
        throw httpError.conflict(
            `Hồ sơ đang ở trạng thái ${dossierStatus}, không thể duyệt/từ chối ở cấp ${checkerConfig.step}`,
        );
    }
}

export async function cancelStaleDraftAssignmentsOnDossier(
    tx: DbTx,
    dossierId: string,
    now: Date,
): Promise<number> {
    const rows = await tx
        .update(dossierAssignments)
        .set({
            status: AssignmentStatus.TRANSFERRED,
            completedAt: now,
        })
        .where(and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.status, AssignmentStatus.DRAFT),
        ))
        .returning({ id: dossierAssignments.id });

    return rows.length;
}
