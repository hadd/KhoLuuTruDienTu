import { DossierStatus } from "../../db/schemas/workflow-constants.ts";

/** dossierId -> assigneeIds with active MAKER assignments */
export type ActiveMakerIndex = Map<string, Set<string>>;

/** dossierId -> assigneeIds with COMPLETED MAKER assignments */
export type CompletedMakerIndex = Map<string, Set<string>>;

export function buildActiveMakerIndex(
    assignments: Array<{ dossierId: string; assigneeId: string }>,
): ActiveMakerIndex {
    const map = new Map<string, Set<string>>();
    for (const row of assignments) {
        const assignees = map.get(row.dossierId) ?? new Set<string>();
        assignees.add(row.assigneeId);
        map.set(row.dossierId, assignees);
    }
    return map;
}

export function buildCompletedMakerIndex(
    assignments: Array<{ dossierId: string; assigneeId: string }>,
): CompletedMakerIndex {
    return buildActiveMakerIndex(assignments);
}

export function hasActiveMakerOnDossier(
    index: ActiveMakerIndex,
    dossierId: string,
): boolean {
    return (index.get(dossierId)?.size ?? 0) > 0;
}

export function hasActiveGroupMakerOnDossier(
    index: ActiveMakerIndex,
    dossierId: string,
    editorIds: Set<string>,
): boolean {
    const assignees = index.get(dossierId);
    if (!assignees) {
        return false;
    }
    for (const assigneeId of assignees) {
        if (editorIds.has(assigneeId)) {
            return true;
        }
    }
    return false;
}

/** True when every MAKER slot is done: no IN_PROGRESS and at least one COMPLETED. */
export function isDossierMakerEntryComplete(
    dossierId: string,
    activeMakerIndex: ActiveMakerIndex,
    completedMakerIndex: CompletedMakerIndex,
): boolean {
    if (hasActiveMakerOnDossier(activeMakerIndex, dossierId)) {
        return false;
    }
    return (completedMakerIndex.get(dossierId)?.size ?? 0) > 0;
}

export function hasCompletedMakerOnDossier(
    completedMakerIndex: CompletedMakerIndex,
    dossierId: string,
): boolean {
    return (completedMakerIndex.get(dossierId)?.size ?? 0) > 0;
}

/** Block maker (re)assignment when entry is done or dossier is approved. */
export function getMakerAssignmentBlockReason(input: {
    dossierStatus: string;
    dossierId: string;
    activeMakerIndex: ActiveMakerIndex;
    completedMakerIndex: CompletedMakerIndex;
}): string | null {
    if (input.dossierStatus === "APPROVED") {
        return "Dossier already approved";
    }
    if (isDossierMakerEntryComplete(
        input.dossierId,
        input.activeMakerIndex,
        input.completedMakerIndex,
    )) {
        return "Dossier maker entry already completed";
    }
    return null;
}

export function countFieldSplitAssignedDossierOrdinals(input: {
    targets: Array<{ dossierId: string }>;
    activeMakerIndex: ActiveMakerIndex;
    completedMakerIndex: CompletedMakerIndex;
    editorIds: Set<string>;
}): number {
    let count = 0;
    for (const target of input.targets) {
        if (isDossierMakerEntryComplete(
            target.dossierId,
            input.activeMakerIndex,
            input.completedMakerIndex,
        )) {
            count++;
            continue;
        }
        if (hasActiveGroupMakerOnDossier(
            input.activeMakerIndex,
            target.dossierId,
            input.editorIds,
        )) {
            count++;
        }
    }
    return count;
}

export function buildActiveCheckerDossierIds(
    assignments: Array<{ dossierId: string }>,
): Set<string> {
    return new Set(assignments.map((row) => row.dossierId));
}

/** Chỉ thu hồi khi hồ sơ thuộc nhóm, còn READY_FOR_ENTRY và chưa hoàn thành entry. */
export function getFolderRevokeBlockReason(input: {
    dossierStatus: string;
    dossierId: string;
    assignedGroupId: string | null;
    groupId: string;
    activeMakerIndex: ActiveMakerIndex;
    completedMakerIndex: CompletedMakerIndex;
}): string | null {
    if (input.assignedGroupId !== input.groupId) {
        if (!input.assignedGroupId) {
            return "Dossier is not assigned to any group";
        }
        return "Dossier is assigned to another group";
    }

    if (input.dossierStatus !== DossierStatus.READY_FOR_ENTRY) {
        return "Dossier has already started or completed processing";
    }

    return getMakerAssignmentBlockReason({
        dossierStatus: input.dossierStatus,
        dossierId: input.dossierId,
        activeMakerIndex: input.activeMakerIndex,
        completedMakerIndex: input.completedMakerIndex,
    });
}
