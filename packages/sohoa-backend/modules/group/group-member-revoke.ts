import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import {
    DossierStatus,
    WORKABLE_ASSIGNMENT_STATUSES,
    WorkerRole,
} from "../../db/schemas/workflow-constants.ts";
import {
    cancelInProgressAssignmentsForAssignee,
    resetDossierEntryStatusAfterMakerReassign,
} from "../../libs/workflow-assignment-utils.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";

const REVOCABLE_MEMBER_DOSSIER_STATUSES = new Set<string>([
    DossierStatus.READY_FOR_ENTRY,
    DossierStatus.ENTRY_PROCESSING,
]);

export type GroupMemberRevokeInput = {
    groupId: string;
    groupName: string;
    userId: string;
    actorId: string;
};

export async function executeGroupMemberRevoke(input: GroupMemberRevokeInput) {
    const emptyResult = {
        group: { id: input.groupId, name: input.groupName },
        userId: input.userId,
        totalTargeted: 0,
        totalRevoked: 0,
        totalSkipped: 0,
        revokedDossierIds: [] as string[],
        assignmentsCancelled: 0,
        skipped: [] as Array<{ dossierId: string; folderId: string; reason: string }>,
    };

    const assignmentRows = await db.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.assigneeId, input.userId),
            eq(dossierAssignments.role, WorkerRole.MAKER),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
        ),
        columns: { dossierId: true },
        with: {
            dossier: {
                columns: {
                    id: true,
                    folderId: true,
                    status: true,
                    assignedGroupId: true,
                    deletedAt: true,
                },
            },
        },
    });

    const seenDossierIds = new Set<string>();
    const targets: Array<{
        dossierId: string;
        folderId: string;
        status: string;
    }> = [];
    const skipped: Array<{ dossierId: string; folderId: string; reason: string }> = [];

    for (const row of assignmentRows) {
        const dossier = row.dossier;
        if (!dossier || dossier.deletedAt != null) {
            continue;
        }
        if (dossier.assignedGroupId !== input.groupId) {
            continue;
        }
        if (seenDossierIds.has(dossier.id)) {
            continue;
        }
        seenDossierIds.add(dossier.id);

        if (!REVOCABLE_MEMBER_DOSSIER_STATUSES.has(dossier.status)) {
            skipped.push({
                dossierId: dossier.id,
                folderId: dossier.folderId,
                reason: "Dossier has already started or completed processing",
            });
            continue;
        }

        targets.push({
            dossierId: dossier.id,
            folderId: dossier.folderId,
            status: dossier.status,
        });
    }

    if (targets.length === 0) {
        return {
            ...emptyResult,
            totalTargeted: skipped.length,
            totalSkipped: skipped.length,
            skipped,
        };
    }

    const totalTargeted = targets.length + skipped.length;
    let assignmentsCancelled = 0;
    const revokedDossierIds: string[] = [];

    await db.transaction(async (tx) => {
        const now = new Date();

        for (const item of targets) {
            const cancelled = await cancelInProgressAssignmentsForAssignee(tx, {
                dossierId: item.dossierId,
                assigneeId: input.userId,
                actorId: input.actorId,
                dossierStatus: item.status,
                now,
                roles: [WorkerRole.MAKER],
                notes: "Cancelled maker assignment due to group member revoke",
            });

            if (cancelled === 0) {
                skipped.push({
                    dossierId: item.dossierId,
                    folderId: item.folderId,
                    reason: "No assignment to revoke",
                });
                continue;
            }

            assignmentsCancelled += cancelled;
            await resetDossierEntryStatusAfterMakerReassign(tx, item.dossierId);

            // Keep assignedGroupId so the dossier stays in the group queue for reassignment.
            const stillActive = await tx.query.dossiers.findFirst({
                where: activeDossierWhere(
                    eq(dossiers.id, item.dossierId),
                    eq(dossiers.assignedGroupId, input.groupId),
                ),
                columns: { id: true },
            });
            if (stillActive) {
                revokedDossierIds.push(item.dossierId);
            }
        }
    });

    return {
        ...emptyResult,
        totalTargeted,
        totalRevoked: revokedDossierIds.length,
        totalSkipped: skipped.length,
        revokedDossierIds,
        assignmentsCancelled,
        skipped,
    };
}
