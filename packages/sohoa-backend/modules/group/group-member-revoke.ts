import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import {
    DossierStatus,
    QC_CHECKER_BY_STEP,
    WORKABLE_ASSIGNMENT_STATUSES,
    WorkerRole,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import {
    cancelInProgressAssignmentsForReassign,
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
    roundNumber: number;
    userId: string;
    actorId: string;
};

function resolveRolesToCancel(roundNumber: number): WorkerRoleType[] {
    const checkerRoles = Array.from({ length: roundNumber }, (_, index) =>
        QC_CHECKER_BY_STEP.get(index + 1)?.role
    ).filter((role): role is WorkerRoleType => role !== undefined);

    return [WorkerRole.MAKER, ...checkerRoles];
}

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
    const rolesToCancel = resolveRolesToCancel(input.roundNumber);

    await db.transaction(async (tx) => {
        const now = new Date();

        for (const item of targets) {
            const cancelled = await cancelInProgressAssignmentsForReassign(tx, {
                dossierId: item.dossierId,
                actorId: input.actorId,
                dossierStatus: item.status,
                now,
                roles: rolesToCancel,
                notes: "Cancelled group assignments due to group member revoke",
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
