import { httpError } from "@shared/common-lib";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { isActiveDossier, activeDossierWhere } from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { groupMembers } from "../../db/schemas/group_members.ts";
import { groups } from "../../db/schemas/groups.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { serializeAllowedFields } from "../../libs/metadata-field-filter.ts";
import {
    isGroupFieldSplitMode,
    resolveGroupEditorRefs,
} from "../metadata-permission/metadata-permission-service.ts";
import {
    groupEditorsByPermissionSlot,
    pickEditorsForFieldSplitDossier,
    toFieldSplitEditors,
} from "../group/group-field-split-assign.ts";
import {
    buildActiveMakerIndex,
    buildCompletedMakerIndex,
    countFieldSplitAssignedDossierOrdinals,
    getMakerAssignmentBlockReason,
    hasActiveGroupMakerOnDossier,
} from "../group/group-assignment-guards.ts";
import {
    AssignmentStatus,
    CHECKER_REJECTED_STATUSES,
    DossierStatus,
    WORKABLE_ASSIGNMENT_STATUSES,
    WorkerRole,
} from "../../db/schemas/workflow-constants.ts";
import { getCurrentAttemptNumber } from "../../libs/workflow-assignment-utils.ts";

const MAKER_ENTRY_STATUSES = [
    DossierStatus.ENTRY_PROCESSING,
    DossierStatus.READY_FOR_ENTRY,
    ...CHECKER_REJECTED_STATUSES,
] as const;

/** Dossier statuses where a stale COMPLETED maker row may be reopened (not partial field-split). */
export const REOPEN_COMPLETED_MAKER_DOSSIER_STATUSES = [
    DossierStatus.READY_FOR_ENTRY,
    ...CHECKER_REJECTED_STATUSES,
] as const;

export function canReopenCompletedMakerDossier(
    dossierStatus: string | null | undefined,
): boolean {
    if (!dossierStatus) return false;
    return (REOPEN_COMPLETED_MAKER_DOSSIER_STATUSES as readonly string[])
        .includes(dossierStatus);
}

export async function findWorkableMakerAssignmentForActor(
    dossierId: string,
    actorId: string,
) {
    const assignment = await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.assigneeId, actorId),
            eq(dossierAssignments.role, WorkerRole.MAKER),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
        ),
        with: { dossier: true },
    });

    if (!isActiveDossier(assignment?.dossier)) {
        return null;
    }

    return assignment;
}

async function reopenCompletedMakerAssignmentIfNeeded(
    dossierId: string,
    actorId: string,
) {
    const completed = await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.assigneeId, actorId),
            eq(dossierAssignments.role, WorkerRole.MAKER),
            eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
        ),
        with: { dossier: true },
        orderBy: (fields, { desc }) => [desc(fields.completedAt)],
    });

    if (!isActiveDossier(completed?.dossier)) {
        return null;
    }

    const dossier = completed.dossier;
    if (!canReopenCompletedMakerDossier(dossier.status)) {
        return null;
    }

    const [reopened] = await db
        .update(dossierAssignments)
        .set({
            status: AssignmentStatus.IN_PROGRESS,
            completedAt: null,
        })
        .where(eq(dossierAssignments.id, completed.id))
        .returning();

    if (!reopened) {
        return null;
    }

    return await db.query.dossierAssignments.findFirst({
        where: eq(dossierAssignments.id, reopened.id),
        with: { dossier: true },
    });
}

/** Reopen the highest-priority COMPLETED maker row for global claim (warehouse re-OCR). */
export async function reopenTopCompletedMakerAssignmentForClaim(
    assigneeId: string,
): Promise<boolean> {
    const completed = await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.assigneeId, assigneeId),
            eq(dossierAssignments.role, WorkerRole.MAKER),
            eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
        ),
        with: { dossier: true },
        orderBy: (fields, { desc }) => [desc(fields.completedAt)],
    });

    if (!isActiveDossier(completed?.dossier)) {
        return false;
    }

    if (!canReopenCompletedMakerDossier(completed.dossier.status)) {
        return false;
    }

    const reopened = await reopenCompletedMakerAssignmentIfNeeded(
        completed.dossierId,
        assigneeId,
    );
    return reopened != null;
}

type FolderDossierTarget = {
    dossierId: string;
    folderId: string;
    status: string;
};

export function resolveFieldSplitDossierOrdinal(input: {
    dossierId: string;
    targets: FolderDossierTarget[];
    activeMakerIndex: ReturnType<typeof buildActiveMakerIndex>;
    completedMakerIndex: ReturnType<typeof buildCompletedMakerIndex>;
    editorIds: Set<string>;
}): number | null {
    const sortedTargets = input.targets;
    const startOrdinal = countFieldSplitAssignedDossierOrdinals({
        targets: sortedTargets,
        activeMakerIndex: input.activeMakerIndex,
        completedMakerIndex: input.completedMakerIndex,
        editorIds: input.editorIds,
    });
    const poolTargets = sortedTargets.filter((target) => {
        const blockReason = getMakerAssignmentBlockReason({
            dossierStatus: target.status,
            dossierId: target.dossierId,
            activeMakerIndex: input.activeMakerIndex,
            completedMakerIndex: input.completedMakerIndex,
        });
        if (blockReason) {
            return false;
        }
        return !hasActiveGroupMakerOnDossier(
            input.activeMakerIndex,
            target.dossierId,
            input.editorIds,
        );
    });
    const poolIndex = poolTargets.findIndex(
        (target) => target.dossierId === input.dossierId,
    );
    if (poolIndex >= 0) {
        return startOrdinal + poolIndex;
    }

    const fullIndex = sortedTargets.findIndex(
        (target) => target.dossierId === input.dossierId,
    );
    return fullIndex >= 0 ? fullIndex : null;
}

export function isActorPickedForFieldSplitDossier(input: {
    actorId: string;
    dossierOrdinal: number;
    editorRefs: Array<{
        userId: string;
        fullName: string | null;
        allowedFields: string[] | null;
        permissionSlotCode?: string;
        slotSortOrder?: number;
    }>;
}): boolean {
    const slotGroups = groupEditorsByPermissionSlot(
        toFieldSplitEditors(input.editorRefs),
    );
    if (slotGroups.length === 0) {
        return false;
    }
    const pickedEditors = pickEditorsForFieldSplitDossier(
        slotGroups,
        input.dossierOrdinal,
    );
    return pickedEditors.some((editor) => editor.userId === input.actorId);
}

async function ensureMakerAssignmentFromGroupPool(
    dossierId: string,
    actorId: string,
) {
    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
    });
    if (!dossier?.assignedGroupId) {
        return null;
    }
    if (!(MAKER_ENTRY_STATUSES as readonly string[]).includes(dossier.status)) {
        return null;
    }

    const existing = await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.assigneeId, actorId),
            eq(dossierAssignments.role, WorkerRole.MAKER),
            ne(dossierAssignments.status, AssignmentStatus.TRANSFERRED),
        ),
        columns: { id: true },
    });
    if (existing) {
        return null;
    }

    const member = await db.query.groupMembers.findFirst({
        where: and(
            eq(groupMembers.groupId, dossier.assignedGroupId),
            eq(groupMembers.userId, actorId),
            eq(groupMembers.role, "editor"),
            isNull(groupMembers.expiredAt),
        ),
        columns: { permissionSlotCode: true },
    });
    if (!member) {
        return null;
    }

    const group = await db.query.groups.findFirst({
        where: eq(groups.id, dossier.assignedGroupId),
        columns: { metadataPermissionConfigId: true },
    });
    if (!group) {
        return null;
    }

    const groupEditors = await db.query.groupMembers.findMany({
        where: and(
            eq(groupMembers.groupId, dossier.assignedGroupId),
            eq(groupMembers.role, "editor"),
            isNull(groupMembers.expiredAt),
        ),
        columns: {
            userId: true,
            permissionSlotCode: true,
        },
        with: {
            userProfile: {
                columns: { fullName: true },
            },
        },
    });
    const editorIds = new Set(groupEditors.map((row) => row.userId));
    const editorRefs = await resolveGroupEditorRefs(
        dossier.assignedGroupId,
        groupEditors.map((row) => ({
            userId: row.userId,
            fullName: row.userProfile?.fullName ?? null,
            permissionSlotCode: row.permissionSlotCode,
        })),
        group.metadataPermissionConfigId,
    );
    const editorRef = editorRefs.find((ref) => ref.userId === actorId);
    if (!editorRef) {
        return null;
    }

    if (isGroupFieldSplitMode(group.metadataPermissionConfigId, groupEditors)) {
        const folderTargets = await db.query.dossiers.findMany({
            where: activeDossierWhere(and(
                eq(dossiers.folderId, dossier.folderId),
                eq(dossiers.assignedGroupId, dossier.assignedGroupId),
            )),
            columns: { id: true, folderId: true, status: true },
            orderBy: [asc(dossiers.createdAt), asc(dossiers.id)],
        });
        const targetDossierIds = folderTargets.map((row) => row.id);
        const [activeMakerAssignments, completedMakerAssignments] = await Promise.all([
            targetDossierIds.length > 0
                ? db.query.dossierAssignments.findMany({
                    where: and(
                        inArray(dossierAssignments.dossierId, targetDossierIds),
                        eq(dossierAssignments.role, WorkerRole.MAKER),
                        inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
                    ),
                    columns: { dossierId: true, assigneeId: true },
                })
                : Promise.resolve([]),
            targetDossierIds.length > 0
                ? db.query.dossierAssignments.findMany({
                    where: and(
                        inArray(dossierAssignments.dossierId, targetDossierIds),
                        eq(dossierAssignments.role, WorkerRole.MAKER),
                        eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
                    ),
                    columns: { dossierId: true, assigneeId: true },
                })
                : Promise.resolve([]),
        ]);
        const activeMakerIndex = buildActiveMakerIndex(activeMakerAssignments);
        const completedMakerIndex = buildCompletedMakerIndex(completedMakerAssignments);
        const dossierOrdinal = resolveFieldSplitDossierOrdinal({
            dossierId,
            targets: folderTargets.map((row) => ({
                dossierId: row.id,
                folderId: row.folderId,
                status: row.status,
            })),
            activeMakerIndex,
            completedMakerIndex,
            editorIds,
        });
        if (
            dossierOrdinal === null
            || !isActorPickedForFieldSplitDossier({
                actorId,
                dossierOrdinal,
                editorRefs,
            })
        ) {
            return null;
        }
    }

    const fromStatus = dossier.status;
    const now = new Date();

    const assignment = await db.transaction(async (tx) => {
        const [lockedDossier] = await tx
            .select()
            .from(dossiers)
            .where(activeDossierWhere(eq(dossiers.id, dossierId)))
            .for("update")
            .limit(1);
        if (!lockedDossier) {
            return null;
        }

        const duplicate = await tx.query.dossierAssignments.findFirst({
            where: and(
                eq(dossierAssignments.dossierId, dossierId),
                eq(dossierAssignments.assigneeId, actorId),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                ne(dossierAssignments.status, AssignmentStatus.TRANSFERRED),
            ),
            columns: { id: true },
        });
        if (duplicate) {
            return null;
        }

        let dossierRow = lockedDossier;
        if (lockedDossier.status === DossierStatus.READY_FOR_ENTRY) {
            const [updatedDossier] = await tx
                .update(dossiers)
                .set({
                    status: DossierStatus.ENTRY_PROCESSING,
                    updatedAt: now,
                })
                .where(activeDossierWhere(
                    eq(dossiers.id, dossierId),
                    eq(dossiers.status, DossierStatus.READY_FOR_ENTRY),
                ))
                .returning();
            if (updatedDossier) {
                dossierRow = updatedDossier;
                await tx.insert(workflowLogs).values({
                    dossierId,
                    actorId,
                    action: "CLAIM_ENTRY",
                    fromStatus,
                    toStatus: DossierStatus.ENTRY_PROCESSING,
                });
            }
        }

        const attemptNumber = await getCurrentAttemptNumber(
            tx,
            dossierId,
            WorkerRole.MAKER,
        );
        const [created] = await tx
            .insert(dossierAssignments)
            .values({
                dossierId,
                role: WorkerRole.MAKER,
                assigneeId: actorId,
                attemptNumber,
                stepNumber: dossierRow.currentQcStep + 1,
                status: AssignmentStatus.IN_PROGRESS,
                allowedFields: serializeAllowedFields(editorRef.allowedFields),
            })
            .returning();

        return created
            ? await tx.query.dossierAssignments.findFirst({
                where: eq(dossierAssignments.id, created.id),
                with: { dossier: true },
            })
            : null;
    });

    return assignment;
}

export async function resolveWorkableMakerAssignmentForActor(
    dossierId: string,
    actorId: string,
) {
    const active = await findWorkableMakerAssignmentForActor(dossierId, actorId);
    if (active) {
        return active;
    }

    const reopened = await reopenCompletedMakerAssignmentIfNeeded(dossierId, actorId);
    if (reopened) {
        return reopened;
    }

    return await ensureMakerAssignmentFromGroupPool(dossierId, actorId);
}

export async function requireWorkableMakerAssignmentForActor(
    dossierId: string,
    actorId: string,
) {
    const assignment = await resolveWorkableMakerAssignmentForActor(
        dossierId,
        actorId,
    );

    if (!assignment) {
        throw httpError.notFound(
            "No workable MAKER assignment found for this dossier",
        );
    }

    return assignment;
}
