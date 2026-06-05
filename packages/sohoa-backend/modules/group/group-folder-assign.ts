import { httpError } from "@shared/common-lib";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import {
    AssignmentStatus,
    WorkerRole,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type DossierAssignTarget = {
    dossierId: string;
    folderId: string;
    name: string;
};

type EditorRef = { userId: string; fullName: string | null };

type QcAssignee = { userId: string; checkerRole: WorkerRoleType; step: number };

export type GroupFolderAssignInput = {
    mode: "initial" | "continue";
    groupId: string;
    groupName: string;
    roundNumber: number;
    folderId: string;
    dossiersPerEditor: number;
    editorUserIds: EditorRef[];
    qcAssignees: QcAssignee[];
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
        },
    ) => Promise<unknown>;
    ensureAssigneeExists: (assigneeId: string) => Promise<unknown>;
};

function editorIdSet(editors: EditorRef[]) {
    return new Set(editors.map((e) => e.userId));
}

function isMakerInProgressFromGroupEditors(
    dossierId: string,
    makerByDossier: Map<string, { assigneeId: string }>,
    editorIds: Set<string>,
) {
    const maker = makerByDossier.get(dossierId);
    return maker !== undefined && editorIds.has(maker.assigneeId);
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

    const activeMakers = await db.query.dossierAssignments.findMany({
        where: and(
            inArray(dossierAssignments.dossierId, groupDossierIds),
            eq(dossierAssignments.role, WorkerRole.MAKER),
            eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
            inArray(dossierAssignments.assigneeId, [...editorIds]),
        ),
        columns: { dossierId: true },
    });

    const activeDossierIds = new Set(activeMakers.map((a) => a.dossierId));
    const active = activeDossierIds.size;
    const queued = groupDossierIds.length - active;

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
            eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
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

export async function executeGroupFolderAssignment(input: GroupFolderAssignInput) {
    const editorIds = editorIdSet(input.editorUserIds);
    const dossierIds = input.targets.map((t) => t.dossierId);

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
    for (const qc of input.qcAssignees) {
        await input.ensureAssigneeExists(qc.userId);
    }

    const checkerRoles = input.qcAssignees.map((qc) => qc.checkerRole);

    const [dossierRecords, activeMakerAssignments, activeCheckerAssignments] = await Promise.all([
        db.query.dossiers.findMany({
            where: activeDossierWhere(inArray(dossiers.id, dossierIds)),
        }),
        db.query.dossierAssignments.findMany({
            where: and(
                inArray(dossierAssignments.dossierId, dossierIds),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
            ),
        }),
        checkerRoles.length > 0
            ? db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, dossierIds),
                    inArray(dossierAssignments.role, checkerRoles),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ),
            })
            : Promise.resolve([]),
    ]);

    const dossierById = new Map(dossierRecords.map((d) => [d.id, d]));
    const makerByDossier = new Map(
        activeMakerAssignments.map((a) => [a.dossierId, { assigneeId: a.assigneeId }]),
    );
    const activeCheckerKeys = new Set(
        activeCheckerAssignments.map((a) => `${a.dossierId}:${a.role}`),
    );

    const skipped: Array<{ dossierId: string; folderId: string; reason: string }> = [];
    const poolTargets: DossierAssignTarget[] = [];
    const markGroupIds: string[] = [];

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
            if (isMakerInProgressFromGroupEditors(target.dossierId, makerByDossier, editorIds)) {
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

        markGroupIds.push(target.dossierId);

        if (makerByDossier.has(target.dossierId)) {
            skipped.push({
                dossierId: target.dossierId,
                folderId: target.folderId,
                reason: "Dossier already has an active MAKER assignment",
            });
            continue;
        }

        poolTargets.push(target);
    }

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
        }> = [];

        let editorIndex = 0;
        for (const target of poolTargets) {
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

        const assignResult = await runAssignmentTransaction({
            input,
            dossierIds,
            assignmentsToCreate,
            distributionMap,
            activeCheckerKeys,
            markGroupOnDossiers: false,
            poolDossierIds: [],
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

    const quotaByEditor = new Map(
        input.editorUserIds.map((editor) => [editor.userId, 0]),
    );
    const maxPerEditor = input.dossiersPerEditor;
    let editorIndex = 0;
    const assignmentsToCreate: Array<{
        target: DossierAssignTarget;
        dossier: typeof dossiers.$inferSelect;
        assigneeId: string;
    }> = [];

    for (const target of poolTargets) {
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

    const assignResult = await runAssignmentTransaction({
        input,
        dossierIds,
        assignmentsToCreate,
        distributionMap,
        activeCheckerKeys,
        markGroupOnDossiers: true,
        poolDossierIds: markGroupIds,
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
    dossierIds: string[];
    assignmentsToCreate: Array<{
        target: DossierAssignTarget;
        dossier: typeof dossiers.$inferSelect;
        assigneeId: string;
    }>;
    distributionMap: Map<string, {
        userId: string;
        fullName: string | null;
        assignedCount: number;
        dossierIds: string[];
    }>;
    activeCheckerKeys: Set<string>;
    markGroupOnDossiers: boolean;
    poolDossierIds: string[];
}) {
    let checkerAssignmentsCreated = 0;
    let dossiersQcCountUpdated = 0;

    await db.transaction(async (tx) => {
        if (ctx.dossierIds.length > 0) {
            const updates: Partial<typeof dossiers.$inferInsert> = {
                requiredQcCount: ctx.input.roundNumber,
                updatedAt: new Date(),
            };

            const [updatedDossiers] = await Promise.all([
                tx
                    .update(dossiers)
                    .set(updates)
                    .where(activeDossierWhere(inArray(dossiers.id, ctx.dossierIds)))
                    .returning({ id: dossiers.id }),
            ]);
            dossiersQcCountUpdated = updatedDossiers.length;
        }

        if (ctx.markGroupOnDossiers && ctx.poolDossierIds.length > 0) {
            await tx
                .update(dossiers)
                .set({
                    assignedGroupId: ctx.input.groupId,
                    updatedAt: new Date(),
                })
                .where(activeDossierWhere(
                    inArray(dossiers.id, ctx.poolDossierIds),
                ));
        }

        for (const item of ctx.assignmentsToCreate) {
            await ctx.input.createDossierAssignmentInTx(tx, {
                dossierId: item.target.dossierId,
                assigneeId: item.assigneeId,
                role: WorkerRole.MAKER,
                actorId: ctx.input.actorId,
                dossierStatus: item.dossier.status,
            });

            for (const qc of ctx.input.qcAssignees) {
                const checkerKey = `${item.target.dossierId}:${qc.checkerRole}`;
                if (ctx.activeCheckerKeys.has(checkerKey)) {
                    continue;
                }

                await ctx.input.createDossierAssignmentInTx(tx, {
                    dossierId: item.target.dossierId,
                    assigneeId: qc.userId,
                    role: qc.checkerRole,
                    stepNumber: qc.step,
                    actorId: ctx.input.actorId,
                    dossierStatus: item.dossier.status,
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

    return { checkerAssignmentsCreated, dossiersQcCountUpdated };
}

export async function getGroupFolderQueue(input: {
    groupId: string;
    editorUserIds: EditorRef[];
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
        };
    }

    const [dossierRows, activeMakers] = await Promise.all([
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
                eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                inArray(dossierAssignments.assigneeId, [...editorIds]),
            ),
            columns: { dossierId: true, assigneeId: true },
        }),
    ]);

    const dossierById = new Map(dossierRows.map((d) => [d.id, d]));
    const activeDossierIds = new Set(activeMakers.map((a) => a.dossierId));

    const queued = dossierRows
        .filter((d) => !activeDossierIds.has(d.id))
        .map((d) => ({
            dossierId: d.id,
            name: d.name,
            folderId: d.folderId,
        }));

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
    };
}
