import { httpError } from "@shared/common-lib";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { groupMembers } from "../../db/schemas/group_members.ts";
import type { GroupMemberRole } from "../../db/schemas/types.ts";
import { groups } from "../../db/schemas/groups.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import { AuthRole } from "../auth/auth-helper.ts";
import {
    DossierService,
    findDossiersInLeafFoldersWithFiles,
    resolveGroupAssignFolderId,
} from "../dossier/dossier-service.ts";
import { getGroupFolderQueue } from "./group-folder-assign.ts";
import {
    assertEachQcLevelHasPeers,
    buildQcWorkflowConfig,
    flattenQcUserIds,
    normalizeGroupQcInput,
    peersByStepFromMembers,
    qcConfigChanged,
    type QcLevelInput,
    type QcWorkflowConfig,
} from "./group-qc-config.ts";
import { QC_GROUP_ROLES, QC_MEMBER_ROLES } from "./group-qc-constants.ts";
import { syncGroupQcWorkflow, type SyncQcWorkflowResult } from "./group-qc-workflow-sync.ts";
import {
    assignByFolderToGroupBodySchema,
    createGroupBodySchema,
    syncQcWorkflowBodySchema,
    updateGroupBodySchema,
} from "./types.ts";
import {
    MetadataPermissionService,
    resolveGroupEditorRefs,
    isGroupFieldSplitMode,
} from "../metadata-permission/metadata-permission-service.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

function validateNoOverlapEditorsAndQcs(editorIds: string[], qcUserIds: string[]) {
    const editorSet = new Set(editorIds);
    const overlap = qcUserIds.filter((id) => editorSet.has(id));
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

    const emptyIds = qcIds.filter((id) => !id.trim());
    if (emptyIds.length > 0) {
        throw httpError.badRequest(
            "QC member ID cannot be empty — use qcLevels with valid user UUIDs",
        );
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
        const foundIds = new Set(users.map((user) => user.id));
        const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
        throw httpError.badRequest(
            `QC member(s) not found: ${missingIds.join(", ")}`,
        );
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

async function validateQcLevels(qcLevels: QcLevelInput[]) {
    for (let i = 0; i < qcLevels.length; i++) {
        const level = qcLevels[i]!;
        const levelLabel = `QC cấp ${i + 1}`;

        if (level.userIds.length === 0) {
            throw httpError.badRequest(`${levelLabel}: cần ít nhất 1 QC`);
        }

        const emptyIds = level.userIds.filter((id) => !id.trim());
        if (emptyIds.length > 0) {
            throw httpError.badRequest(
                `${levelLabel}: ID QC không được để trống — truyền UUID user hợp lệ`,
            );
        }

        const uniqueIds = [...new Set(level.userIds)];
        if (uniqueIds.length !== level.userIds.length) {
            throw httpError.badRequest(`${levelLabel}: trùng ID QC`);
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
            const foundIds = new Set(users.map((user) => user.id));
            const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
            throw httpError.badRequest(
                `${levelLabel}: không tìm thấy QC — ${missingIds.join(", ")}`,
            );
        }

        for (const user of users) {
            if (!user.active) {
                throw httpError.badRequest(
                    `${levelLabel}: ${user.email} đang inactive`,
                );
            }

            const hasQcRole = user.userRoles.some(
                (userRole) => userRole.role.id === AuthRole.QC,
            );
            if (!hasQcRole) {
                throw httpError.badRequest(
                    `${levelLabel}: ${user.email} không có role qc`,
                );
            }
        }
    }
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

async function getActiveGroupOrThrow(groupId: string) {
    const group = await db.query.groups.findFirst({
        where: and(eq(groups.id, groupId), isNull(groups.deletedAt)),
    });

    if (!group) {
        throw httpError.notFound("Group not found");
    }

    return group;
}

async function assertActiveGroupMember(groupId: string, userId: string) {
    const membership = await db.query.groupMembers.findFirst({
        where: and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId),
            isNull(groupMembers.expiredAt),
        ),
        columns: { id: true },
    });

    if (!membership) {
        throw httpError.notFound("Group not found");
    }
}

async function assertActiveGroupLeader(groupId: string, userId: string) {
    const leaderMembership = await db.query.groupMembers.findFirst({
        where: and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId),
            eq(groupMembers.role, "leader"),
            isNull(groupMembers.expiredAt),
        ),
        columns: { id: true },
    });

    if (!leaderMembership) {
        throw httpError.forbidden("Only admin or group leader can delete a group");
    }
}

type GroupMemberWithProfile = {
    id: string;
    userId: string;
    role: GroupMemberRole;
    permissionSlotCode: string | null;
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

async function buildEditorRefsForGroup(group: typeof groups.$inferSelect) {
    const editors = await getActiveEditorsForGroup(group.id);
    return resolveGroupEditorRefs(
        group.id,
        editors.map((member) => ({
            userId: member.userId,
            fullName: member.userProfile.fullName,
            permissionSlotCode: member.permissionSlotCode,
        })),
        group.metadataPermissionConfigId,
    );
}

function assertGroupReadyForFieldSplitAssign(
    group: typeof groups.$inferSelect,
    editors: GroupMemberWithProfile[],
) {
    if (!group.metadataPermissionConfigId) {
        return;
    }
    const editorMembers = editors.filter((m) => m.role === "editor");
    if (!isGroupFieldSplitMode(group.metadataPermissionConfigId, editorMembers)) {
        throw httpError.badRequest(
            "All editors must be assigned a permission slot before assign-by-folder",
        );
    }
}

function getQcLevelsFromMembers(
    members: GroupMemberWithProfile[],
    roundNumber: number,
): QcLevelInput[] {
    return QC_GROUP_ROLES.slice(0, roundNumber).map((role) => ({
        userIds: members
            .filter((member) => member.role === role)
            .map((member) => member.userId),
    }));
}

async function getActiveQcPeersByLevel(groupId: string, roundNumber: number) {
    const members = await getActiveMembersForGroup(groupId);
    return peersByStepFromMembers(members, roundNumber);
}

function buildWorkflowConfigFromGroup(
    roundNumber: number,
    members: GroupMemberWithProfile[],
): QcWorkflowConfig {
    const qcLevels = getQcLevelsFromMembers(members, roundNumber);
    return buildQcWorkflowConfig(roundNumber, qcLevels);
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

    const qcLevels = QC_GROUP_ROLES.slice(0, group.roundNumber).map((role, index) => {
        const levelMembers = members.filter((member) => member.role === role);
        return {
            level: index + 1,
            role,
            members: levelMembers.map((member) => ({
                ...mapMemberSummary(member),
                role: member.role,
            })),
        };
    });

    const qcs = qcLevels
        .map((level) => level.members[0])
        .filter((member): member is NonNullable<typeof member> => member !== undefined)
        .map((member) => ({
            ...member,
            role: member.role as GroupMemberRole,
        }));

    const leaderMember = members.find((member) => member.role === "leader")
        ?? members.find((member) => member.role === "qc1");

    return {
        ...group,
        leader: leaderMember ? mapMemberSummary(leaderMember) : null,
        editors,
        qcs,
        qcLevels,
    };
}

async function insertQcMembers(tx: DbTx, groupId: string, qcLevels: QcLevelInput[]) {
    const rows: Array<{ groupId: string; userId: string; role: GroupMemberRole }> = [];

    for (let i = 0; i < qcLevels.length; i++) {
        const qcRole = QC_GROUP_ROLES[i]!;
        const level = qcLevels[i]!;

        for (let j = 0; j < level.userIds.length; j++) {
            const userId = level.userIds[j]!;
            rows.push({ groupId, userId, role: qcRole });
            if (i === 0 && j === 0) {
                rows.push({ groupId, userId, role: "leader" });
            }
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

async function syncGroupQcs(tx: DbTx, groupId: string, qcLevels: QcLevelInput[]) {
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

    await insertQcMembers(tx, groupId, qcLevels);
}

export const GroupService = {
    async create(input: Static<typeof createGroupBodySchema>) {
        const normalized = normalizeGroupQcInput(input);
        const qcUserIds = flattenQcUserIds(normalized.qcLevels);
        validateNoOverlapEditorsAndQcs(input.editorIds, qcUserIds);
        await validateEditorIds(input.editorIds);
        await validateQcLevels(normalized.qcLevels);
        await assertEditorsNotInOtherGroups(input.editorIds);
        const groupId = await generateGroupId(input.name, input.id);

        const record = await db.transaction(async (tx) => {
            const [group] = await tx
                .insert(groups)
                .values({
                    id: groupId,
                    name: input.name,
                    description: input.description ?? null,
                    roundNumber: normalized.roundNumber,
                })
                .returning();

            await tx.insert(groupMembers).values(
                input.editorIds.map((userId) => ({
                    groupId,
                    userId,
                    role: "editor" as const,
                })),
            );

            await insertQcMembers(tx, groupId, normalized.qcLevels);

            return group;
        });

        const members = await getActiveMembersForGroup(record.id);
        return { record: mapGroupWithMembers(record, members) };
    },

    async list(options?: { memberUserId?: string }) {
        const conditions = [isNull(groups.deletedAt)];

        if (options?.memberUserId) {
            const memberships = await db.query.groupMembers.findMany({
                where: and(
                    eq(groupMembers.userId, options.memberUserId),
                    isNull(groupMembers.expiredAt),
                ),
                columns: { groupId: true },
            });

            const groupIds = [...new Set(memberships.map((member) => member.groupId))];
            if (groupIds.length === 0) {
                return { items: [] };
            }

            conditions.push(inArray(groups.id, groupIds));
        }

        const items = await db.query.groups.findMany({
            where: and(...conditions),
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

    async get(groupId: string, options?: { memberUserId?: string }) {
        const group = await getActiveGroupOrThrow(groupId);

        if (options?.memberUserId) {
            await assertActiveGroupMember(groupId, options.memberUserId);
        }

        const members = await getActiveMembersForGroup(groupId);
        return { record: mapGroupWithMembers(group, members) };
    },

    async update(
        groupId: string,
        input: Static<typeof updateGroupBodySchema>,
        actorId?: string,
    ) {
        const existingGroup = await getActiveGroupOrThrow(groupId);
        const membersBefore = await getActiveMembersForGroup(groupId);
        const previousConfig = buildWorkflowConfigFromGroup(
            existingGroup.roundNumber,
            membersBefore,
        );

        const hasQcInput = input.qcIds !== undefined || input.qcLevels !== undefined;
        if (input.roundNumber !== undefined && !hasQcInput) {
            throw httpError.badRequest(
                "qcLevels or qcIds is required when updating roundNumber",
            );
        }

        let nextQcLevels: QcLevelInput[] | undefined;
        let effectiveRoundNumber = existingGroup.roundNumber;

        if (hasQcInput) {
            const normalized = normalizeGroupQcInput({
                roundNumber: input.roundNumber ?? existingGroup.roundNumber,
                qcIds: input.qcIds,
                qcLevels: input.qcLevels,
            });
            nextQcLevels = normalized.qcLevels;
            effectiveRoundNumber = normalized.roundNumber;
        } else if (input.roundNumber !== undefined) {
            effectiveRoundNumber = input.roundNumber;
        }

        const editorIds = input.editorIds;
        const qcUserIds = nextQcLevels ? flattenQcUserIds(nextQcLevels) : undefined;

        if (editorIds && qcUserIds) {
            validateNoOverlapEditorsAndQcs(editorIds, qcUserIds);
        } else if (editorIds && !qcUserIds) {
            const currentQcUserIds = flattenQcUserIds(
                getQcLevelsFromMembers(membersBefore, existingGroup.roundNumber),
            );
            validateNoOverlapEditorsAndQcs(editorIds, currentQcUserIds);
        } else if (qcUserIds && !editorIds) {
            const currentEditors = await getActiveEditorsForGroup(groupId);
            validateNoOverlapEditorsAndQcs(
                currentEditors.map((member) => member.userId),
                qcUserIds,
            );
        }

        if (editorIds) {
            await validateEditorIds(editorIds);
            const currentMembers = await getActiveEditorsForGroup(groupId);
            const currentUserIds = new Set(currentMembers.map((member) => member.userId));
            const newEditorIds = editorIds.filter((userId) => !currentUserIds.has(userId));
            await assertEditorsNotInOtherGroups(newEditorIds, groupId);
        }

        if (nextQcLevels) {
            await validateQcLevels(nextQcLevels);
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
            if (input.roundNumber !== undefined || hasQcInput) {
                updates.roundNumber = effectiveRoundNumber;
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

            if (nextQcLevels) {
                await syncGroupQcs(tx, groupId, nextQcLevels);
            }

            return group;
        });

        const members = await getActiveMembersForGroup(groupId);
        const nextConfig = buildWorkflowConfigFromGroup(record.roundNumber, members);

        let syncResult: SyncQcWorkflowResult | null = null;
        if (actorId && qcConfigChanged(previousConfig, nextConfig)) {
            syncResult = await syncGroupQcWorkflow({
                groupId,
                actorId,
                previousConfig,
                nextConfig,
            });
        }

        return {
            record: mapGroupWithMembers(record, members),
            syncResult,
        };
    },

    async syncQcWorkflow(
        groupId: string,
        actorId: string,
        scope?: { folderId?: string },
    ) {
        const group = await getActiveGroupOrThrow(groupId);
        const members = await getActiveMembersForGroup(groupId);
        const config = buildWorkflowConfigFromGroup(group.roundNumber, members);
        assertEachQcLevelHasPeers(config.qcPeersByStep, group.roundNumber);

        const syncResult = await syncGroupQcWorkflow({
            groupId,
            actorId,
            previousConfig: config,
            nextConfig: config,
            scope,
        });

        return { syncResult };
    },

    async delete(groupId: string, options?: { actorUserId?: string; isAdmin?: boolean }) {
        await getActiveGroupOrThrow(groupId);

        if (!options?.isAdmin) {
            if (!options?.actorUserId) {
                throw httpError.forbidden("Only admin or group leader can delete a group");
            }
            await assertActiveGroupLeader(groupId, options.actorUserId);
        }
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
        const qcPeersByStep = await getActiveQcPeersByLevel(groupId, group.roundNumber);

        if (editors.length === 0) {
            throw httpError.badRequest("Group has no active editors");
        }

        assertEachQcLevelHasPeers(qcPeersByStep, group.roundNumber);
        assertGroupReadyForFieldSplitAssign(group, await getActiveMembersForGroup(groupId));

        await db
            .update(groups)
            .set({
                dossiersPerEditor: input.dossiersPerEditor,
                updatedAt: new Date(),
            })
            .where(eq(groups.id, groupId));

        const editorUserIds = await buildEditorRefsForGroup(group);

        return await DossierService.assignByFolderToGroup({
            groupId: group.id,
            groupName: group.name,
            roundNumber: group.roundNumber,
            folderId: input.folderId,
            dossiersPerEditor: input.dossiersPerEditor,
            editorUserIds,
            qcPeersByStep,
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
        const qcPeersByStep = await getActiveQcPeersByLevel(groupId, group.roundNumber);

        if (editors.length === 0) {
            throw httpError.badRequest("Group has no active editors");
        }

        assertEachQcLevelHasPeers(qcPeersByStep, group.roundNumber);
        assertGroupReadyForFieldSplitAssign(group, await getActiveMembersForGroup(groupId));

        const editorUserIds = await buildEditorRefsForGroup(group);

        return await DossierService.assignByFolderToGroup({
            groupId: group.id,
            groupName: group.name,
            roundNumber: group.roundNumber,
            folderId: input.folderId,
            dossiersPerEditor: input.dossiersPerEditor,
            editorUserIds,
            qcPeersByStep,
            actorId,
            mode: "continue",
        });
    },

    async getFolderQueue(groupId: string, folderId: string) {
        const group = await getActiveGroupOrThrow(groupId);
        const editorUserIds = await buildEditorRefsForGroup(group);

        const { rootFolder, leafFolders, dossiers: targets } =
            await findDossiersInLeafFoldersWithFiles(folderId);
        const qcPeersByStep = await getActiveQcPeersByLevel(groupId, group.roundNumber);

        return await getGroupFolderQueue({
            groupId,
            editorUserIds,
            qcPeersByStep,
            rootFolder,
            leafFolders,
            targets,
        });
    },

    async bindMetadataPermissionConfig(groupId: string, permissionConfigId: string | null) {
        await getActiveGroupOrThrow(groupId);
        return await MetadataPermissionService.bindGroupConfig(groupId, permissionConfigId);
    },

    async getMetadataPermission(groupId: string) {
        await getActiveGroupOrThrow(groupId);
        return await MetadataPermissionService.getGroupPermission(groupId);
    },

    async setPermissionAssignments(
        groupId: string,
        assignments: Array<{ slotCode: string; editorIds: string[] }>,
    ) {
        await getActiveGroupOrThrow(groupId);
        return await MetadataPermissionService.setGroupPermissionAssignments(
            groupId,
            assignments,
        );
    },

    async autoContinueAfterMakerSubmit(
        groupId: string,
        actorId: string,
        dossierId: string,
        dossierFolderId: string,
    ) {
        const group = await getActiveGroupOrThrow(groupId);
        if (group.dossiersPerEditor == null || group.dossiersPerEditor < 1) {
            return;
        }

        const folderId = await resolveGroupAssignFolderId(
            dossierId,
            groupId,
            dossierFolderId,
        );
        if (!folderId) {
            return;
        }

        const editors = await getActiveEditorsForGroup(groupId);
        const qcPeersByStep = await getActiveQcPeersByLevel(groupId, group.roundNumber);

        try {
            assertEachQcLevelHasPeers(qcPeersByStep, group.roundNumber);
        } catch {
            return;
        }

        const editorUserIds = await buildEditorRefsForGroup(group);

        return await DossierService.assignByFolderToGroup({
            groupId: group.id,
            groupName: group.name,
            roundNumber: group.roundNumber,
            folderId,
            dossiersPerEditor: group.dossiersPerEditor,
            editorUserIds,
            qcPeersByStep,
            actorId,
            mode: "continue",
        });
    },
};
