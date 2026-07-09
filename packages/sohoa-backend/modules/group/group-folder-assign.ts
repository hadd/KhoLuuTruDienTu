import { httpError } from "@shared/common-lib";
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
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { scheduleDossierAssignedNotification } from "../notification/notification-delivery-service.ts";
import {
    cancelInProgressAssignmentsForReassign,
    resetDossierEntryStatusAfterMakerReassign,
} from "../../libs/workflow-assignment-utils.ts";
import {
    groupEditorsByPermissionSlot,
    pickEditorsForFieldSplitDossier,
    toFieldSplitEditors,
} from "./group-field-split-assign.ts";
import {
    buildActiveMakerIndex,
    buildCompletedMakerIndex,
    countFieldSplitAssignedDossierOrdinals,
    getMakerAssignmentBlockReason,
    hasActiveGroupMakerOnDossier,
    hasCompletedMakerOnDossier,
    isDossierMakerEntryComplete,
} from "./group-assignment-guards.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type DossierAssignTarget = {
    dossierId: string;
    folderId: string;
    name: string;
};

type EditorRef = {
    userId: string;
    fullName: string | null;
    allowedFields: string[] | null;
    permissionSlotCode?: string | null;
    slotSortOrder?: number;
};

export type GroupFolderAssignInput = {
    mode: "initial" | "continue";
    groupId: string;
    groupName: string;
    roundNumber: number;
    folderId: string;
    dossiersPerEditor: number;
    editorUserIds: EditorRef[];
    qcPeersByStep: Map<number, string[]>;
    actorId: string;
    targets: DossierAssignTarget[];
    rootFolder: { id: string; folderPath: string; folderName: string };
    leafFolders: Array<{ id: string; folderPath: string; folderName: string }>;
    createDossierAssignmentInTx: (
        tx: DbTx,
        input: {
            dossierId: string;
            assigneeId: string;
            role: WorkerRoleType;
            actorId: string;
            dossierStatus: string;
            stepNumber?: number;
            allowedFields?: string | null;
        },
    ) => Promise<unknown>;
    ensureAssigneeExists: (assigneeId: string) => Promise<unknown>;
};

function editorIdSet(editors: EditorRef[]) {
    return new Set(editors.map((e) => e.userId));
}

export async function computeGroupQueueSummary(
    dossierIds: string[],
    groupId: string,
    editorUserIds: EditorRef[],
) {
    if (dossierIds.length === 0) {
        return { queued: 0, active: 0 };
    }

    const editorIds = editorIdSet(editorUserIds);
    const rows = await db.query.dossiers.findMany({
        where: activeDossierWhere(
            inArray(dossiers.id, dossierIds),
            eq(dossiers.assignedGroupId, groupId),
        ),
        columns: { id: true },
    });
    const groupDossierIds = rows.map((r) => r.id);
    if (groupDossierIds.length === 0) {
        return { queued: 0, active: 0 };
    }

    const [activeMakers, completedMakers] = await Promise.all([
        db.query.dossierAssignments.findMany({
            where: and(
                inArray(dossierAssignments.dossierId, groupDossierIds),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
                inArray(dossierAssignments.assigneeId, [...editorIds]),
            ),
            columns: { dossierId: true, assigneeId: true },
        }),
        db.query.dossierAssignments.findMany({
            where: and(
                inArray(dossierAssignments.dossierId, groupDossierIds),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
                inArray(dossierAssignments.assigneeId, [...editorIds]),
            ),
            columns: { dossierId: true, assigneeId: true },
        }),
    ]);

    const activeMakerIndex = buildActiveMakerIndex(activeMakers);
    const completedMakerIndex = buildCompletedMakerIndex(completedMakers);

    const activeDossierIds = new Set<string>();
    for (const [dossierId, assignees] of activeMakerIndex) {
        for (const assigneeId of assignees) {
            if (editorIds.has(assigneeId)) {
                activeDossierIds.add(dossierId);
            }
        }
    }

    const active = activeDossierIds.size;
    const queued = groupDossierIds.filter((id) =>
        !hasActiveGroupMakerOnDossier(activeMakerIndex, id, editorIds)
        && !isDossierMakerEntryComplete(id, activeMakerIndex, completedMakerIndex)
    ).length;

    return { queued, active };
}

async function countActiveMakerPerEditor(
    groupId: string,
    dossierIds: string[],
    editorUserIds: EditorRef[],
) {
    const counts = new Map(editorUserIds.map((e) => [e.userId, 0]));
    if (dossierIds.length === 0) {
        return counts;
    }

    const editorIds = [...editorIdSet(editorUserIds)];
    const assignments = await db.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.role, WorkerRole.MAKER),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            inArray(dossierAssignments.assigneeId, editorIds),
        ),
        columns: { dossierId: true, assigneeId: true },
    });

    const groupDossierIdSet = new Set(
        (
            await db.query.dossiers.findMany({
                where: activeDossierWhere(
                    inArray(dossiers.id, dossierIds),
                    eq(dossiers.assignedGroupId, groupId),
                ),
                columns: { id: true },
            })
        ).map((d) => d.id),
    );

    for (const row of assignments) {
        if (!groupDossierIdSet.has(row.dossierId)) {
            continue;
        }
        counts.set(row.assigneeId, (counts.get(row.assigneeId) ?? 0) + 1);
    }

    return counts;
}

function isFieldSplitMode(editorUserIds: EditorRef[]): boolean {
    return editorUserIds.some((e) => e.allowedFields !== null);
}

function sortTargetsByInputOrder(
    targets: DossierAssignTarget[],
    inputTargets: DossierAssignTarget[],
): DossierAssignTarget[] {
    const order = new Map(inputTargets.map((target, index) => [target.dossierId, index]));
    return [...targets].sort(
        (a, b) => (order.get(a.dossierId) ?? 0) - (order.get(b.dossierId) ?? 0),
    );
}

function buildFieldSplitMakerAssignments(input: {
    poolTargets: DossierAssignTarget[];
    dossierById: Map<string, typeof dossiers.$inferSelect>;
    editorUserIds: EditorRef[];
    startOrdinal: number;
}): Array<{
    target: DossierAssignTarget;
    dossier: typeof dossiers.$inferSelect;
    assigneeId: string;
    allowedFields: string | null;
}> {
    const slotGroups = groupEditorsByPermissionSlot(toFieldSplitEditors(input.editorUserIds));
    if (slotGroups.length === 0) {
        throw httpError.badRequest("Field-split assignment requires editors with permission slots");
    }

    const assignments: Array<{
        target: DossierAssignTarget;
        dossier: typeof dossiers.$inferSelect;
        assigneeId: string;
        allowedFields: string | null;
    }> = [];

    for (let i = 0; i < input.poolTargets.length; i++) {
        const target = input.poolTargets[i]!;
        const dossier = input.dossierById.get(target.dossierId)!;
        const pickedEditors = pickEditorsForFieldSplitDossier(
            slotGroups,
            input.startOrdinal + i,
        );

        for (const editor of pickedEditors) {
            assignments.push({
                target,
                dossier,
                assigneeId: editor.userId,
                allowedFields: JSON.stringify(editor.allowedFields),
            });
        }
    }

    return assignments;
}

export async function executeGroupFolderAssignment(input: GroupFolderAssignInput) {
    const editorIds = editorIdSet(input.editorUserIds);
    const dossierIds = input.targets.map((t) => t.dossierId);
    const fieldSplit = isFieldSplitMode(input.editorUserIds);

    const distributionMap = new Map(
        input.editorUserIds.map((editor) => [
            editor.userId,
            {
                userId: editor.userId,
                fullName: editor.fullName,
                assignedCount: 0,
                dossierIds: [] as string[],
            },
        ]),
    );

    const emptyResult = {
        mode: input.mode,
        group: { id: input.groupId, name: input.groupName },
        folder: {
            id: input.rootFolder.id,
            folderPath: input.rootFolder.folderPath,
            folderName: input.rootFolder.folderName,
        },
        leafFolders: input.leafFolders,
        dossiersPerEditor: input.dossiersPerEditor,
        totalTargeted: input.targets.length,
        totalAssigned: 0,
        totalSkipped: 0,
        distribution: [...distributionMap.values()],
        skipped: [] as Array<{ dossierId: string; folderId: string; reason: string }>,
        checkerAssignmentsCreated: 0,
        dossiersQcCountUpdated: 0,
        queueSummary: { queued: 0, active: 0 },
    };

    if (input.targets.length === 0 || input.editorUserIds.length === 0) {
        return emptyResult;
    }

    for (const editor of input.editorUserIds) {
        await input.ensureAssigneeExists(editor.userId);
    }
    for (const peers of input.qcPeersByStep.values()) {
        for (const peerId of peers) {
            await input.ensureAssigneeExists(peerId);
        }
    }

    const checkerRoles = [...input.qcPeersByStep.keys()]
        .map((step) => QC_CHECKER_BY_STEP.get(step)?.role)
        .filter((role): role is WorkerRoleType => role !== undefined);

    const [dossierRecords, activeMakerAssignments, completedMakerAssignments, activeCheckerAssignments] =
        await Promise.all([
            db.query.dossiers.findMany({
                where: activeDossierWhere(inArray(dossiers.id, dossierIds)),
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
            checkerRoles.length > 0
                ? db.query.dossierAssignments.findMany({
                    where: and(
                        inArray(dossierAssignments.dossierId, dossierIds),
                        inArray(dossierAssignments.role, checkerRoles),
                        inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
                    ),
                    columns: { dossierId: true, role: true },
                })
                : Promise.resolve([]),
        ]);

    const dossierById = new Map(dossierRecords.map((d) => [d.id, d]));
    const activeMakerIndex = buildActiveMakerIndex(activeMakerAssignments);
    const completedMakerIndex = buildCompletedMakerIndex(completedMakerAssignments);
    const activeCheckerKeys = new Set(
        activeCheckerAssignments.map((a) => `${a.dossierId}:${a.role}`),
    );

    const skipped: Array<{ dossierId: string; folderId: string; reason: string }> = [];
    const poolTargets: DossierAssignTarget[] = [];
    const groupPoolDossierIds: string[] = [];

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

        if (input.mode === "continue") {
            if (dossier.assignedGroupId !== input.groupId) {
                skipped.push({
                    dossierId: target.dossierId,
                    folderId: target.folderId,
                    reason: "Dossier is not in this group's assignment pool",
                });
                continue;
            }
            const blockReason = getMakerAssignmentBlockReason({
                dossierStatus: dossier.status,
                dossierId: target.dossierId,
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
            if (hasActiveGroupMakerOnDossier(activeMakerIndex, target.dossierId, editorIds)) {
                skipped.push({
                    dossierId: target.dossierId,
                    folderId: target.folderId,
                    reason: "Dossier already has an active MAKER assignment",
                });
                continue;
            }
            poolTargets.push(target);
            continue;
        }

        if (dossier.assignedGroupId && dossier.assignedGroupId !== input.groupId) {
            skipped.push({
                dossierId: target.dossierId,
                folderId: target.folderId,
                reason: `Dossier already assigned to group "${dossier.assignedGroupId}"`,
            });
            continue;
        }

        const blockReason = getMakerAssignmentBlockReason({
            dossierStatus: dossier.status,
            dossierId: target.dossierId,
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

        if (hasCompletedMakerOnDossier(completedMakerIndex, target.dossierId)) {
            skipped.push({
                dossierId: target.dossierId,
                folderId: target.folderId,
                reason: "Cannot re-assign: a maker has already submitted entry",
            });
            continue;
        }

        groupPoolDossierIds.push(target.dossierId);
        poolTargets.push(target);
    }

    const orderedPoolTargets = sortTargetsByInputOrder(poolTargets, input.targets);

    if (input.mode === "continue") {
        const activePerEditor = await countActiveMakerPerEditor(
            input.groupId,
            dossierIds,
            input.editorUserIds,
        );
        let totalFreeSlots = 0;
        const freeSlots = new Map<string, number>();
        for (const editor of input.editorUserIds) {
            const active = activePerEditor.get(editor.userId) ?? 0;
            const free = Math.max(0, input.dossiersPerEditor - active);
            freeSlots.set(editor.userId, free);
            totalFreeSlots += free;
        }

        if (totalFreeSlots === 0) {
            throw httpError.conflict(
                "Chưa có biên tập nào hoàn thành hết hồ sơ đang giữ trong nhóm",
            );
        }

        const assignmentsToCreate: Array<{
            target: DossierAssignTarget;
            dossier: typeof dossiers.$inferSelect;
            assigneeId: string;
            allowedFields: string | null;
        }> = [];

        if (fieldSplit) {
            const startOrdinal = countFieldSplitAssignedDossierOrdinals({
                targets: input.targets,
                activeMakerIndex,
                completedMakerIndex,
                editorIds,
            });
            assignmentsToCreate.push(...buildFieldSplitMakerAssignments({
                poolTargets: orderedPoolTargets,
                dossierById,
                editorUserIds: input.editorUserIds,
                startOrdinal,
            }));
        } else {
            let editorIndex = 0;
            for (const target of orderedPoolTargets) {
                const dossier = dossierById.get(target.dossierId)!;
                let assigned = false;

                for (let attempt = 0; attempt < input.editorUserIds.length; attempt++) {
                    const editor = input.editorUserIds[editorIndex];
                    editorIndex = (editorIndex + 1) % input.editorUserIds.length;

                    const slots = freeSlots.get(editor.userId) ?? 0;
                    if (slots <= 0) {
                        continue;
                    }

                    freeSlots.set(editor.userId, slots - 1);
                    assignmentsToCreate.push({
                        target,
                        dossier,
                        assigneeId: editor.userId,
                        allowedFields: null,
                    });
                    assigned = true;
                    break;
                }

                if (!assigned) {
                    skipped.push({
                        dossierId: target.dossierId,
                        folderId: target.folderId,
                        reason: "All editors have reached their dossier quota",
                    });
                }
            }
        }

        const assignResult = await runAssignmentTransaction({
            input,
            assignmentsToCreate,
            distributionMap,
            activeCheckerKeys,
            checkerRoles,
            markGroupOnDossiers: false,
            groupPoolDossierIds: [],
        });

        const queueSummary = await computeGroupQueueSummary(
            dossierIds,
            input.groupId,
            input.editorUserIds,
        );

        return {
            ...emptyResult,
            totalAssigned: assignmentsToCreate.length,
            totalSkipped: skipped.length,
            distribution: [...distributionMap.values()],
            skipped,
            ...assignResult,
            queueSummary,
        };
    }

    const assignmentsToCreate: Array<{
        target: DossierAssignTarget;
        dossier: typeof dossiers.$inferSelect;
        assigneeId: string;
        allowedFields: string | null;
    }> = [];

    if (fieldSplit) {
        assignmentsToCreate.push(...buildFieldSplitMakerAssignments({
            poolTargets: orderedPoolTargets,
            dossierById,
            editorUserIds: input.editorUserIds,
            startOrdinal: 0,
        }));
    } else {
        // Single mode: round-robin with dossiersPerEditor quota.
        const quotaByEditor = new Map(
            input.editorUserIds.map((editor) => [editor.userId, 0]),
        );
        const maxPerEditor = input.dossiersPerEditor;
        let editorIndex = 0;

        for (const target of orderedPoolTargets) {
            const dossier = dossierById.get(target.dossierId)!;
            let assigned = false;

            for (let attempt = 0; attempt < input.editorUserIds.length; attempt++) {
                const editor = input.editorUserIds[editorIndex];
                editorIndex = (editorIndex + 1) % input.editorUserIds.length;

                const currentCount = quotaByEditor.get(editor.userId) ?? 0;
                if (currentCount >= maxPerEditor) {
                    continue;
                }

                quotaByEditor.set(editor.userId, currentCount + 1);
                assignmentsToCreate.push({
                    target,
                    dossier,
                    assigneeId: editor.userId,
                    allowedFields: null,
                });
                assigned = true;
                break;
            }

            if (!assigned) {
                skipped.push({
                    dossierId: target.dossierId,
                    folderId: target.folderId,
                    reason: "All editors have reached their dossier quota",
                });
            }
        }
    }

    const assignResult = await runAssignmentTransaction({
        input,
        assignmentsToCreate,
        distributionMap,
        activeCheckerKeys,
        checkerRoles,
        markGroupOnDossiers: true,
        groupPoolDossierIds,
    });

    const queueSummary = await computeGroupQueueSummary(
        dossierIds,
        input.groupId,
        input.editorUserIds,
    );

    return {
        ...emptyResult,
        totalAssigned: assignmentsToCreate.length,
        totalSkipped: skipped.length,
        distribution: [...distributionMap.values()],
        skipped,
        ...assignResult,
        queueSummary,
    };
}

async function runAssignmentTransaction(ctx: {
    input: GroupFolderAssignInput;
    assignmentsToCreate: Array<{
        target: DossierAssignTarget;
        dossier: typeof dossiers.$inferSelect;
        assigneeId: string;
        allowedFields: string | null;
    }>;
    distributionMap: Map<string, {
        userId: string;
        fullName: string | null;
        assignedCount: number;
        dossierIds: string[];
    }>;
    activeCheckerKeys: Set<string>;
    checkerRoles: WorkerRoleType[];
    markGroupOnDossiers: boolean;
    groupPoolDossierIds: string[];
}) {
    let checkerAssignmentsCreated = 0;
    let dossiersQcCountUpdated = 0;
    const peerCounters = new Map<number, number>();
    const assignmentNotifications: Array<{
        dossierId: string;
        assigneeId: string;
        workerRole: WorkerRoleType;
        dossierName: string;
        folderId: string;
    }> = [];

    const newlyAssignedDossierIds = [
        ...new Set(ctx.assignmentsToCreate.map((item) => item.target.dossierId)),
    ];

    const dossierStatusById = new Map(
        ctx.assignmentsToCreate.map((item) => [item.target.dossierId, item.dossier.status]),
    );

    await db.transaction(async (tx) => {
        const now = new Date();
        const rolesToCancel: WorkerRoleType[] = [
            WorkerRole.MAKER,
            ...ctx.checkerRoles,
        ];

        for (const dossierId of newlyAssignedDossierIds) {
            const dossierStatus = dossierStatusById.get(dossierId) ?? DossierStatus.READY_FOR_ENTRY;
            await cancelInProgressAssignmentsForReassign(tx, {
                dossierId,
                actorId: ctx.input.actorId,
                dossierStatus,
                now,
                roles: rolesToCancel,
            });

            for (const key of [...ctx.activeCheckerKeys]) {
                if (key.startsWith(`${dossierId}:`)) {
                    ctx.activeCheckerKeys.delete(key);
                }
            }

            await resetDossierEntryStatusAfterMakerReassign(tx, dossierId);
        }

        if (newlyAssignedDossierIds.length > 0) {
            const updatedDossiers = await tx
                .update(dossiers)
                .set({
                    requiredQcCount: ctx.input.roundNumber,
                    updatedAt: new Date(),
                })
                .where(activeDossierWhere(inArray(dossiers.id, newlyAssignedDossierIds)))
                .returning({ id: dossiers.id });
            dossiersQcCountUpdated = updatedDossiers.length;
        }

        if (ctx.markGroupOnDossiers && ctx.groupPoolDossierIds.length > 0) {
            await tx
                .update(dossiers)
                .set({
                    assignedGroupId: ctx.input.groupId,
                    updatedAt: new Date(),
                })
                .where(activeDossierWhere(
                    inArray(dossiers.id, ctx.groupPoolDossierIds),
                ));
        }

        for (const item of ctx.assignmentsToCreate) {
            await ctx.input.createDossierAssignmentInTx(tx, {
                dossierId: item.target.dossierId,
                assigneeId: item.assigneeId,
                role: WorkerRole.MAKER,
                actorId: ctx.input.actorId,
                dossierStatus: item.dossier.status,
                allowedFields: item.allowedFields,
            });
            assignmentNotifications.push({
                dossierId: item.target.dossierId,
                assigneeId: item.assigneeId,
                workerRole: WorkerRole.MAKER,
                dossierName: item.target.name,
                folderId: item.target.folderId,
            });

            for (let step = 1; step <= ctx.input.roundNumber; step++) {
                const peers = ctx.input.qcPeersByStep.get(step);
                const checkerConfig = QC_CHECKER_BY_STEP.get(step);
                if (!peers || peers.length === 0 || !checkerConfig) {
                    continue;
                }

                const checkerKey = `${item.target.dossierId}:${checkerConfig.role}`;
                if (ctx.activeCheckerKeys.has(checkerKey)) {
                    continue;
                }

                const counter = peerCounters.get(step) ?? 0;
                const assigneeId = peers[counter % peers.length]!;
                peerCounters.set(step, counter + 1);

                await ctx.input.createDossierAssignmentInTx(tx, {
                    dossierId: item.target.dossierId,
                    assigneeId,
                    role: checkerConfig.role,
                    stepNumber: step,
                    actorId: ctx.input.actorId,
                    dossierStatus: item.dossier.status,
                });
                assignmentNotifications.push({
                    dossierId: item.target.dossierId,
                    assigneeId,
                    workerRole: checkerConfig.role,
                    dossierName: item.target.name,
                    folderId: item.target.folderId,
                });
                ctx.activeCheckerKeys.add(checkerKey);
                checkerAssignmentsCreated += 1;
            }

            const entry = ctx.distributionMap.get(item.assigneeId);
            if (entry) {
                entry.assignedCount += 1;
                entry.dossierIds.push(item.target.dossierId);
            }
        }
    });

    for (const notification of assignmentNotifications) {
        scheduleDossierAssignedNotification(notification);
    }

    return { checkerAssignmentsCreated, dossiersQcCountUpdated };
}

export async function getGroupFolderQueue(input: {
    groupId: string;
    editorUserIds: EditorRef[];
    qcPeersByStep?: Map<number, string[]>;
    rootFolder: { id: string; folderPath: string; folderName: string };
    leafFolders: Array<{ id: string; folderPath: string; folderName: string }>;
    targets: DossierAssignTarget[];
}) {
    const dossierIds = input.targets.map((t) => t.dossierId);
    const editorIds = editorIdSet(input.editorUserIds);

    if (dossierIds.length === 0) {
        return {
            folder: {
                id: input.rootFolder.id,
                folderPath: input.rootFolder.folderPath,
                folderName: input.rootFolder.folderName,
            },
            leafFolders: input.leafFolders.map((f) => ({
                id: f.id,
                folderPath: f.folderPath,
                folderName: f.folderName,
            })),
            queueSummary: { queued: 0, active: 0 },
            queued: [] as Array<{
                dossierId: string;
                name: string;
                folderId: string;
            }>,
            activeByEditor: [] as Array<{
                editorId: string;
                fullName: string | null;
                dossiers: Array<{ dossierId: string; name: string }>;
            }>,
            activeByChecker: [] as Array<{
                step: number;
                peerId: string;
                dossierCount: number;
                dossiers: Array<{ dossierId: string; name: string }>;
            }>,
        };
    }

    const [dossierRows, activeMakers, completedMakers] = await Promise.all([
        db.query.dossiers.findMany({
            where: activeDossierWhere(
                inArray(dossiers.id, dossierIds),
                eq(dossiers.assignedGroupId, input.groupId),
            ),
            columns: { id: true, name: true, folderId: true },
        }),
        db.query.dossierAssignments.findMany({
            where: and(
                inArray(dossierAssignments.dossierId, dossierIds),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
                inArray(dossierAssignments.assigneeId, [...editorIds]),
            ),
            columns: { dossierId: true, assigneeId: true },
        }),
        db.query.dossierAssignments.findMany({
            where: and(
                inArray(dossierAssignments.dossierId, dossierIds),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
                inArray(dossierAssignments.assigneeId, [...editorIds]),
            ),
            columns: { dossierId: true, assigneeId: true },
        }),
    ]);

    const dossierById = new Map(dossierRows.map((d) => [d.id, d]));
    const activeMakerIndex = buildActiveMakerIndex(activeMakers);
    const completedMakerIndex = buildCompletedMakerIndex(completedMakers);

    const queued = dossierRows
        .filter((d) =>
            !hasActiveGroupMakerOnDossier(activeMakerIndex, d.id, editorIds)
            && !isDossierMakerEntryComplete(d.id, activeMakerIndex, completedMakerIndex)
        )
        .map((d) => ({
            dossierId: d.id,
            name: d.name,
            folderId: d.folderId,
        }));

    const activeDossierIds = new Set<string>();
    for (const [dossierId, assignees] of activeMakerIndex) {
        for (const assigneeId of assignees) {
            if (editorIds.has(assigneeId)) {
                activeDossierIds.add(dossierId);
            }
        }
    }

    const activeByEditorMap = new Map<string, Array<{ dossierId: string; name: string }>>();
    for (const editor of input.editorUserIds) {
        activeByEditorMap.set(editor.userId, []);
    }

    for (const maker of activeMakers) {
        const dossier = dossierById.get(maker.dossierId);
        if (!dossier) {
            continue;
        }
        const list = activeByEditorMap.get(maker.assigneeId) ?? [];
        list.push({ dossierId: dossier.id, name: dossier.name });
        activeByEditorMap.set(maker.assigneeId, list);
    }

    const activeByEditor = input.editorUserIds.map((editor) => ({
        editorId: editor.userId,
        fullName: editor.fullName,
        dossiers: activeByEditorMap.get(editor.userId) ?? [],
    }));

    const queueSummary = {
        queued: queued.length,
        active: activeDossierIds.size,
    };

    const activeByChecker: Array<{
        step: number;
        peerId: string;
        dossierCount: number;
        dossiers: Array<{ dossierId: string; name: string }>;
    }> = [];

    if (input.qcPeersByStep && dossierIds.length > 0) {
        const checkerRoles = [...input.qcPeersByStep.keys()]
            .map((step) => QC_CHECKER_BY_STEP.get(step)?.role)
            .filter((role): role is WorkerRoleType => role !== undefined);

        const activeCheckers = checkerRoles.length > 0
            ? await db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, dossierIds),
                    inArray(dossierAssignments.role, checkerRoles),
                    inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
                ),
                columns: { dossierId: true, assigneeId: true, role: true, stepNumber: true },
            })
            : [];

        const bucket = new Map<string, Array<{ dossierId: string; name: string }>>();
        for (const [step, peers] of input.qcPeersByStep) {
            for (const peerId of peers) {
                bucket.set(`${step}:${peerId}`, []);
            }
        }

        for (const assignment of activeCheckers) {
            const dossier = dossierById.get(assignment.dossierId);
            if (!dossier) {
                continue;
            }
            const key = `${assignment.stepNumber}:${assignment.assigneeId}`;
            const list = bucket.get(key) ?? [];
            list.push({ dossierId: dossier.id, name: dossier.name });
            bucket.set(key, list);
        }

        for (const [key, dossiersForPeer] of bucket) {
            const [stepText, peerId] = key.split(":");
            activeByChecker.push({
                step: Number(stepText),
                peerId: peerId!,
                dossierCount: dossiersForPeer.length,
                dossiers: dossiersForPeer,
            });
        }

        activeByChecker.sort((a, b) => a.step - b.step || a.peerId.localeCompare(b.peerId));
    }

    return {
        folder: {
            id: input.rootFolder.id,
            folderPath: input.rootFolder.folderPath,
            folderName: input.rootFolder.folderName,
        },
        leafFolders: input.leafFolders.map((f) => ({
            id: f.id,
            folderPath: f.folderPath,
            folderName: f.folderName,
        })),
        queueSummary,
        queued,
        activeByEditor,
        activeByChecker,
    };
}
