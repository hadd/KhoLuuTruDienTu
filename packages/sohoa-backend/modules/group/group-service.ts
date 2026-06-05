import { httpError } from "@shared/common-lib";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { groupMembers } from "../../db/schemas/group_members.ts";
import type { GroupMemberRole } from "../../db/schemas/types.ts";
import { groups } from "../../db/schemas/groups.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import { QC_CHECKER_WORKFLOW } from "../../db/schemas/workflow-constants.ts";
import { AuthRole } from "../auth/auth-helper.ts";
import { DossierService, findDossiersInLeafFoldersWithFiles } from "../dossier/dossier-service.ts";
import { getGroupFolderQueue } from "./group-folder-assign.ts";
import {
    assignByFolderToGroupBodySchema,
    createGroupBodySchema,
    updateGroupBodySchema,
} from "./types.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const QC_GROUP_ROLES = ["qc1", "qc2", "qc3", "qc4", "qc5"] as const satisfies readonly GroupMemberRole[];

const QC_MEMBER_ROLES: GroupMemberRole[] = [...QC_GROUP_ROLES];

function slugify(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
}

async function generateGroupId(name: string, preferredId?: string): Promise<string> {
    const base = preferredId?.trim() || slugify(name);
    if (!base) {
        throw httpError.badRequest("Cannot generate group ID from name");
    }

    let candidate = base;
    let suffix = 1;

    while (true) {
        const existing = await db.query.groups.findFirst({
            where: eq(groups.id, candidate),
        });
        if (!existing) {
            return candidate;
        }
        candidate = `${base}-${suffix++}`;
    }
}

function validateRoundNumberMatchesQcCount(roundNumber: number, qcIds: string[]) {
    if (qcIds.length !== roundNumber) {
        throw httpError.badRequest(
            `qcIds length (${qcIds.length}) must equal roundNumber (${roundNumber})`,
        );
    }
}

function validateNoOverlapEditorsAndQcs(editorIds: string[], qcIds: string[]) {
    const editorSet = new Set(editorIds);
    const overlap = qcIds.filter((id) => editorSet.has(id));
    if (overlap.length > 0) {
        throw httpError.badRequest(
            "A user cannot be both an editor and a QC member in the same group",
        );
    }
}

async function validateEditorIds(editorIds: string[]) {
    if (editorIds.length === 0) {
        throw httpError.badRequest("At least one editor is required");
    }

    const uniqueIds = [...new Set(editorIds)];
    if (uniqueIds.length !== editorIds.length) {
        throw httpError.badRequest("Duplicate editor IDs");
    }

    const users = await db.query.userProfiles.findMany({
        where: and(
            inArray(userProfiles.id, uniqueIds),
            isNull(userProfiles.deletedAt),
        ),
        with: {
            userRoles: {
                where: isNull(userRoles.expiredAt),
                with: { role: true },
            },
        },
    });

    if (users.length !== uniqueIds.length) {
        throw httpError.badRequest("One or more editors not found");
    }

    for (const user of users) {
        if (!user.active) {
            throw httpError.badRequest(`Editor ${user.email} is inactive`);
        }

        const hasEditorRole = user.userRoles.some(
            (userRole) => userRole.role.id === AuthRole.EDITOR,
        );
        if (!hasEditorRole) {
            throw httpError.badRequest(`User ${user.email} does not have editor role`);
        }
    }

    return users;
}

async function validateQcIds(qcIds: string[]) {
    if (qcIds.length === 0) {
        throw httpError.badRequest("At least one QC member is required");
    }

    const uniqueIds = [...new Set(qcIds)];
    if (uniqueIds.length !== qcIds.length) {
        throw httpError.badRequest("Duplicate QC IDs");
    }

    const users = await db.query.userProfiles.findMany({
        where: and(
            inArray(userProfiles.id, uniqueIds),
            isNull(userProfiles.deletedAt),
        ),
        with: {
            userRoles: {
                where: isNull(userRoles.expiredAt),
                with: { role: true },
            },
        },
    });

    if (users.length !== uniqueIds.length) {
        throw httpError.badRequest("One or more QC members not found");
    }

    for (const user of users) {
        if (!user.active) {
            throw httpError.badRequest(`QC member ${user.email} is inactive`);
        }

        const hasQcRole = user.userRoles.some(
            (userRole) => userRole.role.id === AuthRole.QC,
        );
        if (!hasQcRole) {
            throw httpError.badRequest(`User ${user.email} does not have qc role`);
        }
    }

    return users;
}

async function assertEditorsNotInOtherGroups(
    editorIds: string[],
    excludeGroupId?: string,
) {
    if (editorIds.length === 0) {
        return;
    }

    const conditions = [
        inArray(groupMembers.userId, editorIds),
        eq(groupMembers.role, "editor"),
        isNull(groupMembers.expiredAt),
        isNull(groups.deletedAt),
    ];

    if (excludeGroupId) {
        conditions.push(ne(groupMembers.groupId, excludeGroupId));
    }

    const conflicts = await db
        .select({
            userId: groupMembers.userId,
            email: userProfiles.email,
            groupName: groups.name,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .innerJoin(userProfiles, eq(groupMembers.userId, userProfiles.id))
        .where(and(...conditions));

    if (conflicts.length === 0) {
        return;
    }

    const details = conflicts.map((member) =>
        `${member.email} (nhóm "${member.groupName}")`
    ).join(", ");

    throw httpError.conflict(
        `Mỗi biên tập viên chỉ được thuộc một nhóm tại một thời điểm. Đang thuộc nhóm khác: ${details}`,
    );
}

async function assertQcsNotInOtherGroups(
    qcIds: string[],
    excludeGroupId?: string,
) {
    if (qcIds.length === 0) {
        return;
    }

    const conditions = [
        inArray(groupMembers.userId, qcIds),
        inArray(groupMembers.role, QC_MEMBER_ROLES),
        isNull(groupMembers.expiredAt),
        isNull(groups.deletedAt),
    ];

    if (excludeGroupId) {
        conditions.push(ne(groupMembers.groupId, excludeGroupId));
    }

    const conflicts = await db
        .select({
            userId: groupMembers.userId,
            email: userProfiles.email,
            groupName: groups.name,
            role: groupMembers.role,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .innerJoin(userProfiles, eq(groupMembers.userId, userProfiles.id))
        .where(and(...conditions));

    if (conflicts.length === 0) {
        return;
    }

    const details = conflicts.map((member) =>
        `${member.email} (${member.role}, nhóm "${member.groupName}")`
    ).join(", ");

    throw httpError.conflict(
        `Mỗi QC chỉ được thuộc một nhóm tại một thời điểm. Đang thuộc nhóm khác: ${details}`,
    );
}

async function getActiveGroupOrThrow(groupId: string) {
    const group = await db.query.groups.findFirst({
        where: and(eq(groups.id, groupId), isNull(groups.deletedAt)),
    });

    if (!group) {
        throw httpError.notFound("Group not found");
    }

    return group;
}

type GroupMemberWithProfile = {
    id: string;
    userId: string;
    role: GroupMemberRole;
    userProfile: {
        email: string;
        fullName: string | null;
    };
};

async function getActiveMembersForGroup(groupId: string): Promise<GroupMemberWithProfile[]> {
    return await db.query.groupMembers.findMany({
        where: and(
            eq(groupMembers.groupId, groupId),
            isNull(groupMembers.expiredAt),
        ),
        with: {
            userProfile: true,
        },
        orderBy: (members, { asc }) => [asc(members.createdAt)],
    }) as GroupMemberWithProfile[];
}

async function getActiveEditorsForGroup(groupId: string) {
    const members = await getActiveMembersForGroup(groupId);
    return members.filter((member) => member.role === "editor");
}

async function getActiveQcsForGroup(groupId: string) {
    const members = await getActiveMembersForGroup(groupId);
    return QC_GROUP_ROLES
        .map((role) => members.find((member) => member.role === role))
        .filter((member): member is GroupMemberWithProfile => member !== undefined);
}

function mapMemberSummary(member: GroupMemberWithProfile) {
    return {
        memberId: member.id,
        userId: member.userId,
        email: member.userProfile.email,
        fullName: member.userProfile.fullName,
    };
}

function mapGroupWithMembers(
    group: typeof groups.$inferSelect,
    members: GroupMemberWithProfile[],
) {
    const editors = members
        .filter((member) => member.role === "editor")
        .map(mapMemberSummary);

    const qcs = QC_GROUP_ROLES
        .map((role) => members.find((member) => member.role === role))
        .filter((member): member is GroupMemberWithProfile => member !== undefined)
        .map((member) => ({
            ...mapMemberSummary(member),
            role: member.role,
        }));

    const leaderMember = members.find((member) => member.role === "leader")
        ?? members.find((member) => member.role === "qc1");

    return {
        ...group,
        leader: leaderMember ? mapMemberSummary(leaderMember) : null,
        editors,
        qcs,
    };
}

async function insertQcMembers(tx: DbTx, groupId: string, qcIds: string[]) {
    const rows: Array<{ groupId: string; userId: string; role: GroupMemberRole }> = [];

    for (let i = 0; i < qcIds.length; i++) {
        const qcRole = QC_GROUP_ROLES[i];
        rows.push({ groupId, userId: qcIds[i], role: qcRole });
        if (i === 0) {
            rows.push({ groupId, userId: qcIds[i], role: "leader" });
        }
    }

    if (rows.length > 0) {
        await tx.insert(groupMembers).values(rows);
    }
}

async function syncGroupEditors(tx: DbTx, groupId: string, editorIds: string[]) {
    const now = new Date();
    const current = await tx.query.groupMembers.findMany({
        where: and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.role, "editor"),
            isNull(groupMembers.expiredAt),
        ),
    });

    const currentIds = new Set(current.map((member) => member.userId));
    const newIds = new Set(editorIds);

    for (const member of current) {
        if (!newIds.has(member.userId)) {
            await tx
                .update(groupMembers)
                .set({ expiredAt: now })
                .where(eq(groupMembers.id, member.id));
        }
    }

    for (const userId of editorIds) {
        if (!currentIds.has(userId)) {
            await tx.insert(groupMembers).values({
                groupId,
                userId,
                role: "editor",
            });
        }
    }
}

async function syncGroupQcs(tx: DbTx, groupId: string, qcIds: string[]) {
    const now = new Date();
    const rolesToSync: GroupMemberRole[] = [...QC_MEMBER_ROLES, "leader"];

    const current = await tx.query.groupMembers.findMany({
        where: and(
            eq(groupMembers.groupId, groupId),
            inArray(groupMembers.role, rolesToSync),
            isNull(groupMembers.expiredAt),
        ),
    });

    for (const member of current) {
        await tx
            .update(groupMembers)
            .set({ expiredAt: now })
            .where(eq(groupMembers.id, member.id));
    }

    await insertQcMembers(tx, groupId, qcIds);
}

function buildQcAssigneesFromMembers(
    qcs: GroupMemberWithProfile[],
    roundNumber: number,
) {
    return qcs.slice(0, roundNumber).map((member, index) => {
        const config = QC_CHECKER_WORKFLOW[index];
        return {
            userId: member.userId,
            checkerRole: config.role,
            step: config.step,
        };
    });
}

export const GroupService = {
    async create(input: Static<typeof createGroupBodySchema>) {
        const roundNumber = input.roundNumber ?? input.qcIds.length;
        validateRoundNumberMatchesQcCount(roundNumber, input.qcIds);
        validateNoOverlapEditorsAndQcs(input.editorIds, input.qcIds);
        await validateEditorIds(input.editorIds);
        await validateQcIds(input.qcIds);
        await assertEditorsNotInOtherGroups(input.editorIds);
        await assertQcsNotInOtherGroups(input.qcIds);
        const groupId = await generateGroupId(input.name, input.id);

        const record = await db.transaction(async (tx) => {
            const [group] = await tx
                .insert(groups)
                .values({
                    id: groupId,
                    name: input.name,
                    description: input.description ?? null,
                    roundNumber,
                })
                .returning();

            await tx.insert(groupMembers).values(
                input.editorIds.map((userId) => ({
                    groupId,
                    userId,
                    role: "editor" as const,
                })),
            );

            await insertQcMembers(tx, groupId, input.qcIds);

            return group;
        });

        const members = await getActiveMembersForGroup(record.id);
        return { record: mapGroupWithMembers(record, members) };
    },

    async list() {
        const items = await db.query.groups.findMany({
            where: isNull(groups.deletedAt),
            orderBy: (table, { asc }) => [asc(table.name)],
            with: {
                groupMembers: {
                    where: isNull(groupMembers.expiredAt),
                    with: { userProfile: true },
                },
            },
        });

        return {
            items: items.map((group) =>
                mapGroupWithMembers(
                    group,
                    group.groupMembers as GroupMemberWithProfile[],
                ),
            ),
        };
    },

    async get(groupId: string) {
        const group = await getActiveGroupOrThrow(groupId);
        const members = await getActiveMembersForGroup(groupId);
        return { record: mapGroupWithMembers(group, members) };
    },

    async update(groupId: string, input: Static<typeof updateGroupBodySchema>) {
        const existingGroup = await getActiveGroupOrThrow(groupId);

        if (input.roundNumber !== undefined && input.qcIds === undefined) {
            throw httpError.badRequest(
                "qcIds is required when updating roundNumber",
            );
        }

        const effectiveRoundNumber = input.roundNumber ?? existingGroup.roundNumber;

        if (input.qcIds) {
            validateRoundNumberMatchesQcCount(effectiveRoundNumber, input.qcIds);
        }

        const editorIds = input.editorIds;
        const qcIds = input.qcIds;

        if (editorIds && qcIds) {
            validateNoOverlapEditorsAndQcs(editorIds, qcIds);
        } else if (editorIds && !qcIds) {
            const currentQcs = await getActiveQcsForGroup(groupId);
            validateNoOverlapEditorsAndQcs(
                editorIds,
                currentQcs.map((member) => member.userId),
            );
        } else if (qcIds && !editorIds) {
            const currentEditors = await getActiveEditorsForGroup(groupId);
            validateNoOverlapEditorsAndQcs(
                currentEditors.map((member) => member.userId),
                qcIds,
            );
        }

        if (editorIds) {
            await validateEditorIds(editorIds);
            const currentMembers = await getActiveEditorsForGroup(groupId);
            const currentUserIds = new Set(currentMembers.map((member) => member.userId));
            const newEditorIds = editorIds.filter((userId) => !currentUserIds.has(userId));
            await assertEditorsNotInOtherGroups(newEditorIds, groupId);
        }

        if (qcIds) {
            await validateQcIds(qcIds);
            const currentQcs = await getActiveQcsForGroup(groupId);
            const currentUserIds = new Set(currentQcs.map((member) => member.userId));
            const newQcIds = qcIds.filter((userId) => !currentUserIds.has(userId));
            await assertQcsNotInOtherGroups(newQcIds, groupId);
        }

        const record = await db.transaction(async (tx) => {
            const updates: Partial<typeof groups.$inferInsert> = {
                updatedAt: new Date(),
            };

            if (input.name !== undefined) {
                updates.name = input.name;
            }
            if (input.description !== undefined) {
                updates.description = input.description;
            }
            if (input.roundNumber !== undefined) {
                updates.roundNumber = input.roundNumber;
            }

            const [group] = await tx
                .update(groups)
                .set(updates)
                .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
                .returning();

            if (!group) {
                throw httpError.notFound("Group not found");
            }

            if (input.editorIds) {
                await syncGroupEditors(tx, groupId, input.editorIds);
            }

            if (input.qcIds) {
                await syncGroupQcs(tx, groupId, input.qcIds);
            }

            return group;
        });

        const members = await getActiveMembersForGroup(groupId);
        return { record: mapGroupWithMembers(record, members) };
    },

    async delete(groupId: string) {
        await getActiveGroupOrThrow(groupId);
        const now = new Date();

        await db.transaction(async (tx) => {
            await tx
                .update(groups)
                .set({ deletedAt: now, updatedAt: now })
                .where(eq(groups.id, groupId));

            await tx
                .update(groupMembers)
                .set({ expiredAt: now })
                .where(and(
                    eq(groupMembers.groupId, groupId),
                    isNull(groupMembers.expiredAt),
                ));
        });

        return { status: "deleted" as const, id: groupId };
    },

    async assignByFolder(
        groupId: string,
        input: Static<typeof assignByFolderToGroupBodySchema>,
        actorId: string,
    ) {
        const group = await getActiveGroupOrThrow(groupId);
        const editors = await getActiveEditorsForGroup(groupId);
        const qcs = await getActiveQcsForGroup(groupId);

        if (editors.length === 0) {
            throw httpError.badRequest("Group has no active editors");
        }

        if (qcs.length !== group.roundNumber) {
            throw httpError.badRequest(
                `Group must have ${group.roundNumber} active QC members (found ${qcs.length})`,
            );
        }

        const qcAssignees = buildQcAssigneesFromMembers(qcs, group.roundNumber);

        return await DossierService.assignByFolderToGroup({
            groupId: group.id,
            groupName: group.name,
            roundNumber: group.roundNumber,
            folderId: input.folderId,
            dossiersPerEditor: input.dossiersPerEditor,
            editorUserIds: editors.map((member) => ({
                userId: member.userId,
                fullName: member.userProfile.fullName,
            })),
            qcAssignees,
            actorId,
            mode: "initial",
        });
    },

    async continueAssignByFolder(
        groupId: string,
        input: Static<typeof assignByFolderToGroupBodySchema>,
        actorId: string,
    ) {
        const group = await getActiveGroupOrThrow(groupId);
        const editors = await getActiveEditorsForGroup(groupId);
        const qcs = await getActiveQcsForGroup(groupId);

        if (editors.length === 0) {
            throw httpError.badRequest("Group has no active editors");
        }

        if (qcs.length !== group.roundNumber) {
            throw httpError.badRequest(
                `Group must have ${group.roundNumber} active QC members (found ${qcs.length})`,
            );
        }

        const qcAssignees = buildQcAssigneesFromMembers(qcs, group.roundNumber);

        return await DossierService.assignByFolderToGroup({
            groupId: group.id,
            groupName: group.name,
            roundNumber: group.roundNumber,
            folderId: input.folderId,
            dossiersPerEditor: input.dossiersPerEditor,
            editorUserIds: editors.map((member) => ({
                userId: member.userId,
                fullName: member.userProfile.fullName,
            })),
            qcAssignees,
            actorId,
            mode: "continue",
        });
    },

    async getFolderQueue(groupId: string, folderId: string) {
        await getActiveGroupOrThrow(groupId);
        const editors = await getActiveEditorsForGroup(groupId);

        const { rootFolder, leafFolders, dossiers: targets } =
            await findDossiersInLeafFoldersWithFiles(folderId);

        return await getGroupFolderQueue({
            groupId,
            editorUserIds: editors.map((member) => ({
                userId: member.userId,
                fullName: member.userProfile.fullName,
            })),
            rootFolder,
            leafFolders,
            targets,
        });
    },
};
