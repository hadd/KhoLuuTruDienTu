import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { groupMembers } from "../../db/schemas/group_members.ts";
import { groups } from "../../db/schemas/groups.ts";
import {
    AssignmentStatus,
    DossierStatus,
    QC_CHECKER_BY_STEP,
    WORKABLE_ASSIGNMENT_STATUSES,
    WorkerRole,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { cancelInProgressAssignmentsForReassign } from "../../libs/workflow-assignment-utils.ts";
import { activeDossierWhere } from "./active-query-filters.ts";
import {
    buildActiveMakerIndex,
    buildCompletedMakerIndex,
    getDossierRevokeBlockReason,
} from "../group/group-assignment-guards.ts";
import { peersByStepFromMembers } from "../group/group-qc-config.ts";

type DossierAssignTarget = {
    dossierId: string;
    folderId: string;
    name: string;
};

export type FolderAssignmentRevokeInput = {
    folderId: string;
    actorId: string;
    targets: DossierAssignTarget[];
    rootFolder: { id: string; folderPath: string; folderName: string };
    leafFolders: Array<{ id: string; folderPath: string; folderName: string }>;
};

async function loadQcPeersByGroupId(groupIds: string[]) {
    const result = new Map<string, Map<number, string[]>>();
    if (groupIds.length === 0) {
        return result;
    }

    const [groupRows, memberRows] = await Promise.all([
        db.query.groups.findMany({
            where: and(
                inArray(groups.id, groupIds),
                isNull(groups.deletedAt),
            ),
            columns: { id: true, roundNumber: true },
        }),
        db.query.groupMembers.findMany({
            where: and(
                inArray(groupMembers.groupId, groupIds),
                isNull(groupMembers.expiredAt),
            ),
            columns: { groupId: true, userId: true, role: true },
        }),
    ]);

    const membersByGroupId = new Map<string, Array<{ userId: string; role: typeof memberRows[number]["role"] }>>();
    for (const member of memberRows) {
        const list = membersByGroupId.get(member.groupId) ?? [];
        list.push({ userId: member.userId, role: member.role });
        membersByGroupId.set(member.groupId, list);
    }

    for (const group of groupRows) {
        const members = membersByGroupId.get(group.id) ?? [];
        result.set(group.id, peersByStepFromMembers(members, group.roundNumber));
    }

    return result;
}

function resolveRolesToCancel(
    assignedGroupId: string | null,
    qcPeersByGroupId: Map<string, Map<number, string[]>>,
): WorkerRoleType[] | undefined {
    if (!assignedGroupId) {
        return undefined;
    }

    const qcPeersByStep = qcPeersByGroupId.get(assignedGroupId);
    if (!qcPeersByStep) {
        return [WorkerRole.MAKER];
    }

    const checkerRoles = [...qcPeersByStep.keys()]
        .map((step) => QC_CHECKER_BY_STEP.get(step)?.role)
        .filter((role): role is WorkerRoleType => role !== undefined);

    return [WorkerRole.MAKER, ...checkerRoles];
}

export async function executeFolderAssignmentRevoke(input: FolderAssignmentRevokeInput) {
    const dossierIds = input.targets.map((target) => target.dossierId);

    const emptyResult = {
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

    const [dossierRecords, activeMakerAssignments, completedMakerAssignments, workableAssignments] =
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
            db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, dossierIds),
                    inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
                ),
                columns: { dossierId: true },
            }),
        ]);

    const dossierById = new Map(dossierRecords.map((dossier) => [dossier.id, dossier]));
    const activeMakerIndex = buildActiveMakerIndex(activeMakerAssignments);
    const completedMakerIndex = buildCompletedMakerIndex(completedMakerAssignments);
    const workableAssignmentDossierIds = new Set(workableAssignments.map((row) => row.dossierId));

    const assignedGroupIds = [
        ...new Set(
            dossierRecords
                .map((dossier) => dossier.assignedGroupId)
                .filter((groupId): groupId is string => groupId !== null),
        ),
    ];
    const qcPeersByGroupId = await loadQcPeersByGroupId(assignedGroupIds);

    const skipped: Array<{ dossierId: string; folderId: string; reason: string }> = [];
    const dossiersToRevoke: Array<{
        dossierId: string;
        folderId: string;
        status: string;
        assignedGroupId: string | null;
    }> = [];

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

        const blockReason = getDossierRevokeBlockReason({
            dossierStatus: dossier.status,
            dossierId: target.dossierId,
            assignedGroupId: dossier.assignedGroupId,
            activeMakerIndex,
            completedMakerIndex,
            hasWorkableAssignment: workableAssignmentDossierIds.has(target.dossierId),
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
            assignedGroupId: dossier.assignedGroupId,
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
                roles: resolveRolesToCancel(item.assignedGroupId, qcPeersByGroupId),
                notes: "Cancelled assignments due to folder assignment revoke",
            });

            const updated = await tx
                .update(dossiers)
                .set({ assignedGroupId: null, updatedAt: now })
                .where(activeDossierWhere(
                    eq(dossiers.id, item.dossierId),
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
