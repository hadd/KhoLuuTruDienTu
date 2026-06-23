import { and, eq, inArray } from "drizzle-orm";
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

type DossierAssignTarget = {
    dossierId: string;
    folderId: string;
    name: string;
};

export type GroupFolderRevokeInput = {
    groupId: string;
    groupName: string;
    roundNumber: number;
    folderId: string;
    actorId: string;
    targets: DossierAssignTarget[];
    rootFolder: { id: string; folderPath: string; folderName: string };
    leafFolders: Array<{ id: string; folderPath: string; folderName: string }>;
    qcPeersByStep: Map<number, string[]>;
};

export async function executeGroupFolderRevoke(input: GroupFolderRevokeInput) {
    const dossierIds = input.targets.map((t) => t.dossierId);

    const emptyResult = {
        group: { id: input.groupId, name: input.groupName },
        folder: {
            id: input.rootFolder.id,
            folderPath: input.rootFolder.folderPath,
            folderName: input.rootFolder.folderName,
        },
        leafFolders: input.leafFolders,
        totalTargeted: input.targets.length,
        totalRevoked: 0,
        totalSkipped: 0,
        revokedDossierIds: [] as string[],
        assignmentsCancelled: 0,
        skipped: [] as Array<{ dossierId: string; folderId: string; reason: string }>,
    };

    if (input.targets.length === 0) {
        return emptyResult;
    }

    const checkerRoles = [...input.qcPeersByStep.keys()]
        .map((step) => QC_CHECKER_BY_STEP.get(step)?.role)
        .filter((role): role is WorkerRoleType => role !== undefined);

    const rolesToCancel: WorkerRoleType[] = [
        WorkerRole.MAKER,
        ...checkerRoles,
    ];

    const [dossierRecords, activeMakerAssignments, completedMakerAssignments] =
        await Promise.all([
            db.query.dossiers.findMany({
                where: activeDossierWhere(inArray(dossiers.id, dossierIds)),
                columns: {
                    id: true,
                    status: true,
                    assignedGroupId: true,
                },
            }),
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

    const dossierById = new Map(dossierRecords.map((d) => [d.id, d]));
    const activeMakerIndex = buildActiveMakerIndex(activeMakerAssignments);
    const completedMakerIndex = buildCompletedMakerIndex(completedMakerAssignments);

    const skipped: Array<{ dossierId: string; folderId: string; reason: string }> = [];
    const dossiersToRevoke: Array<{ dossierId: string; folderId: string; status: string }> = [];

    for (const target of input.targets) {
        const dossier = dossierById.get(target.dossierId);
        if (!dossier) {
            skipped.push({
                dossierId: target.dossierId,
                folderId: target.folderId,
                reason: "Dossier not found",
            });
            continue;
        }

        const blockReason = getFolderRevokeBlockReason({
            dossierStatus: dossier.status,
            dossierId: target.dossierId,
            assignedGroupId: dossier.assignedGroupId,
            groupId: input.groupId,
            activeMakerIndex,
            completedMakerIndex,
        });
        if (blockReason) {
            skipped.push({
                dossierId: target.dossierId,
                folderId: target.folderId,
                reason: blockReason,
            });
            continue;
        }

        dossiersToRevoke.push({
            dossierId: target.dossierId,
            folderId: target.folderId,
            status: dossier.status,
        });
    }

    if (dossiersToRevoke.length === 0) {
        return {
            ...emptyResult,
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
                notes: "Cancelled assignments due to folder assignment revoke",
            });

            const updated = await tx
                .update(dossiers)
                .set({ assignedGroupId: null, updatedAt: now })
                .where(activeDossierWhere(
                    eq(dossiers.id, item.dossierId),
                    eq(dossiers.assignedGroupId, input.groupId),
                    eq(dossiers.status, DossierStatus.READY_FOR_ENTRY),
                ))
                .returning({ id: dossiers.id });

            if (updated.length > 0) {
                revokedDossierIds.push(item.dossierId);
            }
        }
    });

    return {
        ...emptyResult,
        totalRevoked: revokedDossierIds.length,
        totalSkipped: skipped.length,
        revokedDossierIds,
        assignmentsCancelled,
        skipped,
    };
}
