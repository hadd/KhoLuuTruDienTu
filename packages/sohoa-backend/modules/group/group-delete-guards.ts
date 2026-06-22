import { httpError } from "@shared/common-lib";
import { and, eq, inArray } from "drizzle-orm";
import type { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import {
    DossierStatus,
    QC_CHECKER_WORKFLOW,
    type DossierStatus as DossierStatusType,
} from "../../db/schemas/workflow-constants.ts";
import { cancelInProgressAssignmentsForReassign } from "../../libs/workflow-assignment-utils.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbConn = typeof db;

/** Trạng thái hồ sơ chặn xóa nhóm: đang nhập hoặc chờ QC claim. */
export const GROUP_DELETE_BLOCKING_STATUSES = [
    DossierStatus.ENTRY_PROCESSING,
    ...QC_CHECKER_WORKFLOW.map((step) => step.waiting),
] as const satisfies readonly DossierStatusType[];

export async function findBlockingDossiersForGroupDelete(
    conn: DbConn | DbTx,
    groupId: string,
) {
    return await conn.query.dossiers.findMany({
        where: activeDossierWhere(
            eq(dossiers.assignedGroupId, groupId),
            inArray(dossiers.status, [...GROUP_DELETE_BLOCKING_STATUSES]),
        ),
        columns: { id: true, status: true },
    });
}

export function assertGroupDeleteAllowed(blocking: Array<{ status: string }>) {
    if (blocking.length === 0) {
        return;
    }

    const statuses = [...new Set(blocking.map((row) => row.status))];
    throw httpError.conflict(
        "Không thể xóa nhóm khi còn hồ sơ đang nhập liệu hoặc chờ kiểm tra.",
        {
            code: "GROUP_HAS_BLOCKING_DOSSIERS",
            blockingCount: blocking.length,
            statuses,
        },
    );
}

/** Gỡ phân công và bỏ gán nhóm cho hồ sơ READY_FOR_ENTRY trước khi xóa mềm nhóm. */
export async function cleanupReadyForEntryDossiersOnGroupDelete(
    tx: DbTx,
    input: { groupId: string; actorId: string; now: Date },
): Promise<number> {
    const readyDossiers = await tx.query.dossiers.findMany({
        where: activeDossierWhere(
            eq(dossiers.assignedGroupId, input.groupId),
            eq(dossiers.status, DossierStatus.READY_FOR_ENTRY),
        ),
        columns: { id: true, status: true },
    });

    for (const dossier of readyDossiers) {
        await cancelInProgressAssignmentsForReassign(tx, {
            dossierId: dossier.id,
            actorId: input.actorId,
            dossierStatus: dossier.status,
            now: input.now,
            notes: "Cancelled assignments because group was deleted",
        });

        await tx
            .update(dossiers)
            .set({ assignedGroupId: null, updatedAt: input.now })
            .where(and(
                eq(dossiers.id, dossier.id),
                eq(dossiers.status, DossierStatus.READY_FOR_ENTRY),
            ));
    }

    return readyDossiers.length;
}
