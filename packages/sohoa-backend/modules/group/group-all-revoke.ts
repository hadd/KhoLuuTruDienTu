import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import {
    AssignmentStatus,
    DossierStatus,
    QC_CHECKER_BY_STEP,
    WORKABLE_ASSIGNMENT_STATUSES,
    WorkerRole,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { cancelInProgressAssignmentsForReassign } from "../../libs/workflow-assignment-utils.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import {
    buildActiveMakerIndex,
    buildCompletedMakerIndex,
    getFolderRevokeBlockReason,
} from "./group-assignment-guards.ts";

export type GroupAllRevokeInput = {
    groupId: string;
    groupName: string;
    roundNumber: number;
    actorId: string;
    qcPeersByStep: Map<number, string[]>;
};

export async function executeGroupAllRevoke(input: GroupAllRevokeInput) {
    const emptyResult = {
        group: { id: input.groupId, name: input.groupName },
        totalTargeted: 0,
        totalRevoked: 0,
        totalSkipped: 0,
        revokedDossierIds: [] as string[],
        assignmentsCancelled: 0,
        skipped: [] as Array<{ dossierId: string; folderId: string; reason: string }>,
    };

    const targets = await db.query.dossiers.findMany({
        where: and(
            eq(dossiers.assignedGroupId, input.groupId),
            isNull(dossiers.deletedAt),
        ),
        columns: {
            id: true,
            folderId: true,
            name: true,
            status: true,
            assignedGroupId: true,
        },
    });

    if (targets.length === 0) {
        return emptyResult;
    }

    const dossierIds = targets.map((row) => row.id);

    const checkerRoles = [...input.qcPeersByStep.keys()]
        .map((step) => QC_CHECKER_BY_STEP.get(step)?.role)
        .filter((role): role is WorkerRoleType => role !== undefined);

    const rolesToCancel: WorkerRoleType[] = [
        WorkerRole.MAKER,
        ...checkerRoles,
    ];

    const [activeMakerAssignments, completedMakerAssignments] = await Promise.all([
        db.query.dossierAssignments.findMany({
            where: and(
                inArray(dossierAssignments.dossierId, dossierIds),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            ),
            columns: { dossierId: true, assigneeId: true },
        }),
        db.query.dossierAssignments.findMany({
            where: and(
                inArray(dossierAssignments.dossierId, dossierIds),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
            ),
            columns: { dossierId: true, assigneeId: true },
        }),
    ]);

    const activeMakerIndex = buildActiveMakerIndex(activeMakerAssignments);
    const completedMakerIndex = buildCompletedMakerIndex(completedMakerAssignments);

    const skipped: Array<{ dossierId: string; folderId: string; reason: string }> = [];
    const dossiersToRevoke: Array<{ dossierId: string; folderId: string; status: string }> = [];

    for (const target of targets) {
        const blockReason = getFolderRevokeBlockReason({
            dossierStatus: target.status,
            dossierId: target.id,
            assignedGroupId: target.assignedGroupId,
            groupId: input.groupId,
            activeMakerIndex,
            completedMakerIndex,
        });
        if (blockReason) {
            skipped.push({
                dossierId: target.id,
                folderId: target.folderId,
                reason: blockReason,
            });
            continue;
        }

        dossiersToRevoke.push({
            dossierId: target.id,
            folderId: target.folderId,
            status: target.status,
        });
    }

    if (dossiersToRevoke.length === 0) {
        return {
            ...emptyResult,
            totalTargeted: targets.length,
            totalSkipped: skipped.length,
            skipped,
        };
    }

    let assignmentsCancelled = 0;
    const revokedDossierIds: string[] = [];

    await db.transaction(async (tx) => {
        const now = new Date();

        for (const item of dossiersToRevoke) {
            assignmentsCancelled += await cancelInProgressAssignmentsForReassign(tx, {
                dossierId: item.dossierId,
                actorId: input.actorId,
                dossierStatus: item.status,
                now,
                roles: rolesToCancel,
                notes: "Cancelled assignments due to group revoke-all",
            });

            const updated = await tx
                .update(dossiers)
                .set({
                    assignedGroupId: null,
                    status: DossierStatus.READY_FOR_ENTRY,
                    updatedAt: now,
                })
                .where(activeDossierWhere(
                    eq(dossiers.id, item.dossierId),
                    eq(dossiers.assignedGroupId, input.groupId),
                    inArray(dossiers.status, [
                        DossierStatus.READY_FOR_ENTRY,
                        DossierStatus.ENTRY_PROCESSING,
                    ]),
                ))
                .returning({ id: dossiers.id });

            if (updated.length > 0) {
                revokedDossierIds.push(item.dossierId);
            } else {
                skipped.push({
                    dossierId: item.dossierId,
                    folderId: item.folderId,
                    reason: "Dossier could not be unassigned from group",
                });
            }
        }
    });

    return {
        ...emptyResult,
        totalTargeted: targets.length,
        totalRevoked: revokedDossierIds.length,
        totalSkipped: skipped.length,
        revokedDossierIds,
        assignmentsCancelled,
        skipped,
    };
}
