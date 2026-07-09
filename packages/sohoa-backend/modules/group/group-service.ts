import { httpError } from "@shared/common-lib";
import { and, asc, count, eq, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { groupMembers } from "../../db/schemas/group_members.ts";
import type { GroupMemberRole } from "../../db/schemas/types.ts";
import { groups } from "../../db/schemas/groups.ts";
import { projects } from "../../db/schemas/project.ts";
import { folders } from "../../db/schemas/folder.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { userRolesHaveDataEntryMakerOnly, userRolesHavePermission } from "../auth/permission-resolver.ts";
import {
    DossierService,
    findDossiersInLeafFoldersWithFiles,
    resolveGroupAssignFolderId,
} from "../dossier/dossier-service.ts";
import { getGroupFolderQueue } from "./group-folder-assign.ts";
import { executeGroupFolderRevoke } from "./group-folder-revoke.ts";
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
    assertGroupDeleteAllowed,
    cleanupReadyForEntryDossiersOnGroupDelete,
    findBlockingDossiersForGroupDelete,
} from "./group-delete-guards.ts";
import {
    assignByFolderToGroupBodySchema,
    createGroupBodySchema,
    revokeByFolderFromGroupBodySchema,
    syncQcWorkflowBodySchema,
    updateGroupBodySchema,
} from "./types.ts";
import {
    MetadataPermissionService,
    resolveGroupEditorRefs,
    isGroupFieldSplitMode,
    buildGroupPermissionPayload,
    resolveActivePermissionConfig,
} from "../metadata-permission/metadata-permission-service.ts";
import { ProjectService } from "../project/project-service.ts";

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

        if (!userRolesHaveDataEntryMakerOnly(user.userRoles)) {
            if (userRolesHavePermission(user.userRoles, Permission.DATA_ENTRY_CHECKER)) {
                throw httpError.badRequest(
                    `User ${user.email} has ${Permission.DATA_ENTRY_CHECKER} and cannot be assigned as group editor`,
                );
            }
            throw httpError.badRequest(
                `User ${user.email} does not have permission ${Permission.DATA_ENTRY_MAKER}`,
            );
        }
    }

    return users;
}

async function validateLeaderId(leaderId: string) {
    const user = await db.query.userProfiles.findFirst({
        where: and(
            eq(userProfiles.id, leaderId),
            isNull(userProfiles.deletedAt),
        ),
        with: {
            userRoles: {
                where: isNull(userRoles.expiredAt),
                with: { role: true },
            },
        },
    });

    if (!user) {
        throw httpError.badRequest("Leader not found");
    }

    if (!user.active) {
        throw httpError.badRequest(`Leader ${user.email} is inactive`);
    }

    if (!userRolesHavePermission(user.userRoles, Permission.DATA_ENTRY_CHECKER)) {
        throw httpError.badRequest(
            `User ${user.email} does not have permission ${Permission.DATA_ENTRY_CHECKER}`,
        );
    }

    return user;
}

function validateLeaderNotEditor(editorIds: string[], leaderId: string) {
    if (editorIds.includes(leaderId)) {
        throw httpError.badRequest(
            "Leader cannot also be an editor in the same group",
        );
    }
}

function resolveQc1LeaderId(
    qcLevels: QcLevelInput[],
    options?: { leaderId?: string; previousLeaderId?: string },
): string | undefined {
    const qc1Ids = qcLevels[0]?.userIds ?? [];
    if (qc1Ids.length === 0) {
        return undefined;
    }

    if (options?.leaderId && qc1Ids.includes(options.leaderId)) {
        return options.leaderId;
    }

    if (options?.previousLeaderId && qc1Ids.includes(options.previousLeaderId)) {
        return options.previousLeaderId;
    }

    return qc1Ids[0];
}

async function assertLeaderInQc1Level(
    leaderId: string,
    qc1UserIds: string[],
    editorIds: string[],
) {
    if (!qc1UserIds.includes(leaderId)) {
        throw httpError.badRequest("leaderId must be one of the QC level 1 members");
    }

    validateLeaderNotEditor(editorIds, leaderId);
    await validateLeaderId(leaderId);
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

            if (!userRolesHavePermission(user.userRoles, Permission.DATA_ENTRY_CHECKER)) {
                throw httpError.badRequest(
                    `${levelLabel}: ${user.email} không có quyền ${Permission.DATA_ENTRY_CHECKER}`,
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
            userProfile: {
                columns: {
                    email: true,
                    fullName: true,
                },
            },
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

type FolderAssignResult = Awaited<ReturnType<typeof DossierService.assignByFolderToGroup>>;

function uniqueFolderIds(folderIds: string[]) {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const folderId of folderIds) {
        if (seen.has(folderId)) {
            continue;
        }
        seen.add(folderId);
        unique.push(folderId);
    }
    return unique;
}

function aggregateFolderAssignResults(results: FolderAssignResult[]) {
    if (results.length === 0) {
        throw httpError.badRequest("At least one folderId is required");
    }

    const first = results[0]!;
    const distributionMap = new Map(
        first.distribution.map((entry) => [
            entry.userId,
            {
                userId: entry.userId,
                fullName: entry.fullName,
                assignedCount: 0,
                dossierIds: [] as string[],
            },
        ]),
    );

    let totalTargeted = 0;
    let totalAssigned = 0;
    let totalSkipped = 0;
    let checkerAssignmentsCreated = 0;
    let dossiersQcCountUpdated = 0;
    const skipped: FolderAssignResult["skipped"] = [];
    const leafFolders: FolderAssignResult["leafFolders"] = [];
    let queued = 0;
    let active = 0;
    const folderResults: Array<{
        folder: FolderAssignResult["folder"];
        leafFolders: FolderAssignResult["leafFolders"];
        totalTargeted: number;
        totalAssigned: number;
        totalSkipped: number;
        skipped: FolderAssignResult["skipped"];
        checkerAssignmentsCreated: number;
        dossiersQcCountUpdated: number;
        queueSummary: FolderAssignResult["queueSummary"];
    }> = [];

    for (const result of results) {
        totalTargeted += result.totalTargeted;
        totalAssigned += result.totalAssigned;
        totalSkipped += result.totalSkipped;
        checkerAssignmentsCreated += result.checkerAssignmentsCreated;
        dossiersQcCountUpdated += result.dossiersQcCountUpdated;
        skipped.push(...result.skipped);
        leafFolders.push(...result.leafFolders);
        queued += result.queueSummary.queued;
        active += result.queueSummary.active;

        for (const entry of result.distribution) {
            const aggregated = distributionMap.get(entry.userId);
            if (!aggregated) {
                continue;
            }
            aggregated.assignedCount += entry.assignedCount;
            aggregated.dossierIds.push(...entry.dossierIds);
        }

        folderResults.push({
            folder: result.folder,
            leafFolders: result.leafFolders,
            totalTargeted: result.totalTargeted,
            totalAssigned: result.totalAssigned,
            totalSkipped: result.totalSkipped,
            skipped: result.skipped,
            checkerAssignmentsCreated: result.checkerAssignmentsCreated,
            dossiersQcCountUpdated: result.dossiersQcCountUpdated,
            queueSummary: result.queueSummary,
        });
    }

    const aggregated = {
        mode: first.mode,
        group: first.group,
        dossiersPerEditor: first.dossiersPerEditor,
        totalTargeted,
        totalAssigned,
        totalSkipped,
        distribution: [...distributionMap.values()],
        skipped,
        checkerAssignmentsCreated,
        dossiersQcCountUpdated,
        queueSummary: { queued, active },
        folderResults,
    };

    if (results.length === 1) {
        return {
            ...aggregated,
            folder: first.folder,
            leafFolders: first.leafFolders,
        };
    }

    return aggregated;
}

type FolderRevokeResult = Awaited<ReturnType<typeof executeGroupFolderRevoke>>;

function aggregateFolderRevokeResults(results: FolderRevokeResult[]) {
    if (results.length === 0) {
        throw httpError.badRequest("At least one folderId is required");
    }

    const first = results[0]!;
    let totalTargeted = 0;
    let totalRevoked = 0;
    let totalSkipped = 0;
    let assignmentsCancelled = 0;
    const revokedDossierIds: string[] = [];
    const skipped: FolderRevokeResult["skipped"] = [];
    const leafFolders: FolderRevokeResult["leafFolders"] = [];
    const folderResults: Array<{
        folder: FolderRevokeResult["folder"];
        leafFolders: FolderRevokeResult["leafFolders"];
        totalTargeted: number;
        totalRevoked: number;
        totalSkipped: number;
        revokedDossierIds: string[];
        assignmentsCancelled: number;
        skipped: FolderRevokeResult["skipped"];
    }> = [];

    for (const result of results) {
        totalTargeted += result.totalTargeted;
        totalRevoked += result.totalRevoked;
        totalSkipped += result.totalSkipped;
        assignmentsCancelled += result.assignmentsCancelled;
        revokedDossierIds.push(...result.revokedDossierIds);
        skipped.push(...result.skipped);
        leafFolders.push(...result.leafFolders);

        folderResults.push({
            folder: result.folder,
            leafFolders: result.leafFolders,
            totalTargeted: result.totalTargeted,
            totalRevoked: result.totalRevoked,
            totalSkipped: result.totalSkipped,
            revokedDossierIds: result.revokedDossierIds,
            assignmentsCancelled: result.assignmentsCancelled,
            skipped: result.skipped,
        });
    }

    const aggregated = {
        group: first.group,
        totalTargeted,
        totalRevoked,
        totalSkipped,
        revokedDossierIds,
        assignmentsCancelled,
        skipped,
        folderResults,
    };

    if (results.length === 1) {
        return {
            ...aggregated,
            folder: first.folder,
            leafFolders: first.leafFolders,
        };
    }

    return aggregated;
}

async function runRevokeByFolders(
    group: typeof groups.$inferSelect,
    folderIds: string[],
    qcPeersByStep: Map<number, string[]>,
    actorId: string,
) {
    const uniqueIds = uniqueFolderIds(folderIds);
    const results: FolderRevokeResult[] = [];

    for (const folderId of uniqueIds) {
        const { rootFolder, leafFolders, dossiers: targets } =
            await findDossiersInLeafFoldersWithFiles(folderId);

        const result = await executeGroupFolderRevoke({
            groupId: group.id,
            groupName: group.name,
            roundNumber: group.roundNumber,
            folderId,
            actorId,
            targets,
            rootFolder,
            leafFolders,
            qcPeersByStep,
        });
        results.push(result);
    }

    return aggregateFolderRevokeResults(results);
}

async function assertGroupFoldersMatchProject(
    group: typeof groups.$inferSelect,
    folderIds: string[],
) {
    if (!group.projectCode) {
        return;
    }

    const uniqueIds = [...new Set(folderIds)];
    const rows = await db.query.folders.findMany({
        where: and(
            inArray(folders.id, uniqueIds),
            isNull(folders.deletedAt),
        ),
        columns: { id: true, projectCode: true, folderPath: true },
    });

    if (rows.length !== uniqueIds.length) {
        throw httpError.badRequest("One or more folders not found");
    }

    for (const folder of rows) {
        if (folder.projectCode !== group.projectCode) {
            throw httpError.badRequest(
                `Folder ${folder.folderPath} does not belong to project ${group.projectCode}`,
            );
        }
    }
}

async function runAssignByFolders(
    group: typeof groups.$inferSelect,
    folderIds: string[],
    dossiersPerEditor: number,
    editorUserIds: Awaited<ReturnType<typeof buildEditorRefsForGroup>>,
    qcPeersByStep: Map<number, string[]>,
    actorId: string,
    mode: "initial" | "continue",
) {
    const uniqueIds = uniqueFolderIds(folderIds);
    const results: FolderAssignResult[] = [];

    for (const folderId of uniqueIds) {
        const result = await DossierService.assignByFolderToGroup({
            groupId: group.id,
            groupName: group.name,
            roundNumber: group.roundNumber,
            folderId,
            dossiersPerEditor,
            editorUserIds,
            qcPeersByStep,
            actorId,
            mode,
        });
        results.push(result);
    }

    return aggregateFolderAssignResults(results);
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

function findLeaderUserId(members: GroupMemberWithProfile[]): string | undefined {
    return members.find((member) => member.role === "leader")?.userId
        ?? members.find((member) => member.role === "qc1")?.userId;
}

function mapMemberSummary(member: GroupMemberWithProfile) {
    return {
        memberId: member.id,
        userId: member.userId,
        email: member.userProfile.email,
        fullName: member.userProfile.fullName,
    };
}

function mapEditorSummary(member: GroupMemberWithProfile) {
    return {
        ...mapMemberSummary(member),
        permissionSlotCode: member.permissionSlotCode,
    };
}

function pickGroupColumns(group: typeof groups.$inferSelect) {
    return {
        id: group.id,
        name: group.name,
        description: group.description,
        projectCode: group.projectCode,
        roundNumber: group.roundNumber,
        dossiersPerEditor: group.dossiersPerEditor,
        metadataPermissionConfigId: group.metadataPermissionConfigId,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
    };
}

function mapGroupPermissionFromMembers(
    members: GroupMemberWithProfile[],
    config?: Parameters<typeof resolveActivePermissionConfig>[0],
) {
    return buildGroupPermissionPayload({
        config: resolveActivePermissionConfig(config),
        editors: members.filter((member) => member.role === "editor"),
    });
}

function mapGroupWithMembers(
    group: typeof groups.$inferSelect,
    members: GroupMemberWithProfile[],
    permission?: ReturnType<typeof buildGroupPermissionPayload>,
) {
    const editors = members
        .filter((member) => member.role === "editor")
        .map(mapEditorSummary);

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
        ...pickGroupColumns(group),
        leader: leaderMember ? mapMemberSummary(leaderMember) : null,
        editors,
        qcs,
        qcLevels,
        permissionConfig: permission?.permissionConfig ?? null,
        assignments: permission?.assignments ?? [],
    };
}

type GroupListSummaryOptions = {
    memberUserId?: string;
    projectCodes?: string[];
    projectCode?: string;
    search?: string;
    page?: number;
    limit?: number;
};

type GroupMemberLeaderRow = {
    groupId: string;
    role: GroupMemberRole;
    userId: string;
    userProfile: {
        email: string;
        fullName: string | null;
    };
};

type GroupListSummaryItem = ReturnType<typeof pickGroupColumns> & {
    metadataPermissionConfigName: string | null;
    memberCount: number;
    editorCount: number;
    qcCount: number;
    leader: {
        userId: string;
        fullName: string | null;
        email: string;
    } | null;
};

function emptyListSummaryPage(page: number, limit: number) {
    return {
        items: [] as GroupListSummaryItem[],
        page,
        limit,
        total: 0,
        totalPages: 0,
    };
}

async function buildGroupListWhereConditions(options?: GroupListSummaryOptions) {
    const conditions = [isNull(groups.deletedAt)];

    if (options?.projectCodes !== undefined) {
        if (options.projectCodes.length === 0) {
            return { empty: true as const, conditions };
        }
        conditions.push(inArray(groups.projectCode, options.projectCodes));
    }

    if (options?.projectCode) {
        conditions.push(eq(groups.projectCode, options.projectCode));
    }

    if (options?.search?.trim()) {
        const term = `%${options.search.trim()}%`;
        conditions.push(
            sql`(${groups.name} ILIKE ${term} OR COALESCE(${groups.description}, '') ILIKE ${term})`,
        );
    }

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
            return { empty: true as const, conditions };
        }

        conditions.push(inArray(groups.id, groupIds));
    }

    return { empty: false as const, conditions };
}

function resolveLeaderSummaryByGroup(
    groupIds: string[],
    leaderRows: GroupMemberLeaderRow[],
) {
    const summaryByGroupId = new Map<string, {
        userId: string;
        fullName: string | null;
        email: string;
    } | null>();

    for (const groupId of groupIds) {
        const membersForGroup = leaderRows.filter((row) => row.groupId === groupId);
        const leaderMember = membersForGroup.find((row) => row.role === "leader")
            ?? membersForGroup.find((row) => row.role === "qc1");

        summaryByGroupId.set(
            groupId,
            leaderMember
                ? {
                    userId: leaderMember.userId,
                    fullName: leaderMember.userProfile.fullName,
                    email: leaderMember.userProfile.email,
                }
                : null,
        );
    }

    return summaryByGroupId;
}

function resolveMemberCountsByGroup(
    groupIds: string[],
    roleCounts: Array<{ groupId: string; role: GroupMemberRole; total: number }>,
    distinctMemberCounts: Map<string, number>,
) {
    const countsByGroupId = new Map<string, {
        memberCount: number;
        editorCount: number;
        qcCount: number;
    }>();

    for (const groupId of groupIds) {
        countsByGroupId.set(groupId, {
            memberCount: distinctMemberCounts.get(groupId) ?? 0,
            editorCount: 0,
            qcCount: 0,
        });
    }

    for (const row of roleCounts) {
        const current = countsByGroupId.get(row.groupId);
        if (!current) {
            continue;
        }

        if (row.role === "editor") {
            current.editorCount += row.total;
        }
        if (QC_MEMBER_ROLES.includes(row.role)) {
            current.qcCount += row.total;
        }
    }

    return countsByGroupId;
}

async function resolveProjectName(projectCode: string | null) {
    if (!projectCode) {
        return null;
    }

    const project = await db.query.projects.findFirst({
        where: and(eq(projects.projectCode, projectCode), isNull(projects.deletedAt)),
        columns: { projectName: true },
    });

    return project?.projectName ?? null;
}

async function syncGroupLeader(tx: DbTx, groupId: string, leaderId: string) {
    const now = new Date();
    const currentLeaders = await tx.query.groupMembers.findMany({
        where: and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.role, "leader"),
            isNull(groupMembers.expiredAt),
        ),
    });

    for (const member of currentLeaders) {
        if (member.userId !== leaderId) {
            await tx
                .update(groupMembers)
                .set({ expiredAt: now })
                .where(eq(groupMembers.id, member.id));
        }
    }

    const hasActiveLeader = currentLeaders.some((member) => member.userId === leaderId);
    if (!hasActiveLeader) {
        await tx.insert(groupMembers).values({
            groupId,
            userId: leaderId,
            role: "leader",
        });
    }
}

async function insertQcMembers(
    tx: DbTx,
    groupId: string,
    qcLevels: QcLevelInput[],
    leaderId?: string,
) {
    const rows: Array<{ groupId: string; userId: string; role: GroupMemberRole }> = [];
    const resolvedLeaderId = resolveQc1LeaderId(qcLevels, { leaderId });

    for (let i = 0; i < qcLevels.length; i++) {
        const qcRole = QC_GROUP_ROLES[i]!;
        const level = qcLevels[i]!;

        for (const userId of level.userIds) {
            rows.push({ groupId, userId, role: qcRole });
            if (i === 0 && userId === resolvedLeaderId) {
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

async function syncGroupQcs(
    tx: DbTx,
    groupId: string,
    qcLevels: QcLevelInput[],
    leaderId?: string,
) {
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

    await insertQcMembers(tx, groupId, qcLevels, leaderId);
}

export const GroupService = {
    async create(input: Static<typeof createGroupBodySchema>) {
        const normalized = normalizeGroupQcInput(input);
        const qcUserIds = flattenQcUserIds(normalized.qcLevels);
        const noApprover = normalized.roundNumber === 0;
        let qcLeaderId: string | undefined;

        if (noApprover) {
            if (!input.leaderId) {
                throw httpError.badRequest(
                    "leaderId is required when roundNumber is 0 (no approver)",
                );
            }
            if (input.qcLevels?.length) {
                throw httpError.badRequest("roundNumber 0 cannot have QC members");
            }
            validateLeaderNotEditor(input.editorIds, input.leaderId);
            await validateLeaderId(input.leaderId);
        } else {
            validateNoOverlapEditorsAndQcs(input.editorIds, qcUserIds);
            await validateQcLevels(normalized.qcLevels);

            if (input.leaderId) {
                await assertLeaderInQc1Level(
                    input.leaderId,
                    normalized.qcLevels[0]?.userIds ?? [],
                    input.editorIds,
                );
                qcLeaderId = input.leaderId;
            }
        }

        await validateEditorIds(input.editorIds);
        await assertEditorsNotInOtherGroups(input.editorIds);
        await ProjectService.assertProjectExists(input.projectCode);
        const groupId = await generateGroupId(input.name, input.id);

        const record = await db.transaction(async (tx) => {
            const [group] = await tx
                .insert(groups)
                .values({
                    id: groupId,
                    name: input.name,
                    description: input.description ?? null,
                    projectCode: input.projectCode,
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

            if (noApprover) {
                await syncGroupLeader(tx, groupId, input.leaderId!);
            } else {
                await insertQcMembers(tx, groupId, normalized.qcLevels, qcLeaderId);
            }

            return group;
        });

        const members = await getActiveMembersForGroup(record.id);
        return { record: mapGroupWithMembers(record, members) };
    },

    async listSummary(options?: GroupListSummaryOptions) {
        const page = Math.max(1, options?.page ?? 1);
        const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
        const offset = (page - 1) * limit;

        const scope = await buildGroupListWhereConditions(options);
        if (scope.empty) {
            return emptyListSummaryPage(page, limit);
        }

        const whereClause = and(...scope.conditions);

        const [totalRow] = await db
            .select({ total: count() })
            .from(groups)
            .where(whereClause);
        const total = Number(totalRow?.total ?? 0);
        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

        if (total === 0) {
            return emptyListSummaryPage(page, limit);
        }

        const rows = await db.query.groups.findMany({
            where: whereClause,
            orderBy: (table, { asc }) => [asc(table.name)],
            limit,
            offset,
            with: {
                metadataPermissionConfig: {
                    columns: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        const groupIds = rows.map((group) => group.id);

        const roleCountRows = await db
            .select({
                groupId: groupMembers.groupId,
                role: groupMembers.role,
                total: count(),
            })
            .from(groupMembers)
            .where(and(
                inArray(groupMembers.groupId, groupIds),
                isNull(groupMembers.expiredAt),
            ))
            .groupBy(groupMembers.groupId, groupMembers.role);

        const distinctMemberRows = await db
            .select({
                groupId: groupMembers.groupId,
                memberCount: sql<number>`count(distinct ${groupMembers.userId})::int`,
            })
            .from(groupMembers)
            .where(and(
                inArray(groupMembers.groupId, groupIds),
                isNull(groupMembers.expiredAt),
            ))
            .groupBy(groupMembers.groupId);

        const distinctMemberCounts = new Map(
            distinctMemberRows.map((row) => [row.groupId, Number(row.memberCount)]),
        );

        const leaderRows = await db.query.groupMembers.findMany({
            where: and(
                inArray(groupMembers.groupId, groupIds),
                inArray(groupMembers.role, ["leader", "qc1"]),
                isNull(groupMembers.expiredAt),
            ),
            with: {
                userProfile: {
                    columns: {
                        email: true,
                        fullName: true,
                    },
                },
            },
        }) as GroupMemberLeaderRow[];

        const countsByGroupId = resolveMemberCountsByGroup(
            groupIds,
            roleCountRows.map((row) => ({
                groupId: row.groupId,
                role: row.role,
                total: Number(row.total),
            })),
            distinctMemberCounts,
        );
        const leaderByGroupId = resolveLeaderSummaryByGroup(groupIds, leaderRows);

        return {
            items: rows.map((group) => {
                const counts = countsByGroupId.get(group.id) ?? {
                    memberCount: 0,
                    editorCount: 0,
                    qcCount: 0,
                };

                return {
                    ...pickGroupColumns(group),
                    metadataPermissionConfigName: group.metadataPermissionConfig?.name ?? null,
                    ...counts,
                    leader: leaderByGroupId.get(group.id) ?? null,
                };
            }),
            page,
            limit,
            total,
            totalPages,
        };
    },

    /** @deprecated Use listSummary — kept as alias for internal callers during migration */
    async list(options?: GroupListSummaryOptions) {
        const result = await this.listSummary(options);
        return { items: result.items };
    },

    async listWithProjects(
        options?: GroupListSummaryOptions,
        assignableProjectCodes?: string[],
    ) {
        const list = await this.listSummary(options);

        if (assignableProjectCodes !== undefined && assignableProjectCodes.length === 0) {
            return {
                ...list,
                items: list.items.map((group) => ({
                    ...group,
                    projectName: null,
                })),
                projects: [],
            };
        }

        const projectResult = await ProjectService.list({
            limit: 200,
            projectCodes: assignableProjectCodes,
        });
        const projectNameByCode = new Map(
            projectResult.items.map((project) => [project.projectCode, project.projectName]),
        );

        return {
            ...list,
            items: list.items.map((group) => ({
                ...group,
                projectName: group.projectCode
                    ? projectNameByCode.get(group.projectCode) ?? null
                    : null,
            })),
            projects: projectResult.items.map((project) => ({
                projectCode: project.projectCode,
                projectName: project.projectName,
            })),
        };
    },

    async listUnassignedEditors() {
        const assignedRows = await db
            .selectDistinct({ userId: groupMembers.userId })
            .from(groupMembers)
            .innerJoin(groups, eq(groupMembers.groupId, groups.id))
            .where(and(
                eq(groupMembers.role, "editor"),
                isNull(groupMembers.expiredAt),
                isNull(groups.deletedAt),
            ));

        const assignedIds = assignedRows.map((row) => row.userId);
        const profileConditions = [
            eq(userProfiles.active, true),
            isNull(userProfiles.deletedAt),
        ];

        if (assignedIds.length > 0) {
            profileConditions.push(notInArray(userProfiles.id, assignedIds));
        }

        const users = await db.query.userProfiles.findMany({
            where: and(...profileConditions),
            with: {
                userRoles: {
                    where: isNull(userRoles.expiredAt),
                    with: { role: true },
                },
            },
            orderBy: [asc(userProfiles.fullName), asc(userProfiles.email)],
        });

        return {
            items: users
                .filter((user) => userRolesHaveDataEntryMakerOnly(user.userRoles))
                .map((user) => ({
                    userId: user.id,
                    email: user.email,
                    fullName: user.fullName,
                })),
        };
    },

    async get(groupId: string, options?: { memberUserId?: string }) {
        const group = await db.query.groups.findFirst({
            where: and(eq(groups.id, groupId), isNull(groups.deletedAt)),
            with: {
                metadataPermissionConfig: {
                    with: {
                        template: true,
                        slots: {
                            orderBy: (slots, { asc }) => [asc(slots.sortOrder)],
                        },
                    },
                },
            },
        });

        if (!group) {
            throw httpError.notFound("Group not found");
        }

        if (options?.memberUserId) {
            await assertActiveGroupMember(groupId, options.memberUserId);
        }

        const members = await getActiveMembersForGroup(groupId);
        const permission = mapGroupPermissionFromMembers(
            members,
            group.metadataPermissionConfig,
        );
        const projectName = await resolveProjectName(group.projectCode);
        return {
            record: {
                ...mapGroupWithMembers(group, members, permission),
                projectName,
            },
        };
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

        const hasQcInput = input.qcLevels !== undefined;
        if (input.roundNumber !== undefined && input.roundNumber !== 0 && !hasQcInput) {
            throw httpError.badRequest(
                "qcLevels is required when updating roundNumber",
            );
        }

        let nextQcLevels: QcLevelInput[] | undefined;
        let effectiveRoundNumber = existingGroup.roundNumber;

        if (hasQcInput) {
            const normalized = normalizeGroupQcInput({
                roundNumber: input.roundNumber ?? existingGroup.roundNumber,
                qcLevels: input.qcLevels,
            });
            nextQcLevels = normalized.qcLevels;
            effectiveRoundNumber = normalized.roundNumber;
        } else if (input.roundNumber !== undefined) {
            effectiveRoundNumber = input.roundNumber;
            if (input.roundNumber === 0) {
                nextQcLevels = [];
            }
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

        if (input.projectCode !== undefined) {
            await ProjectService.assertProjectExists(input.projectCode);
        }

        if (nextQcLevels && nextQcLevels.length > 0) {
            await validateQcLevels(nextQcLevels);
        }

        const willHaveNoApprover = nextQcLevels !== undefined
            ? nextQcLevels.length === 0
            : effectiveRoundNumber === 0;

        let effectiveLeaderId: string | undefined;
        let qcLeaderId: string | undefined;
        if (willHaveNoApprover) {
            effectiveLeaderId = input.leaderId ?? findLeaderUserId(membersBefore);
            if (!effectiveLeaderId) {
                throw httpError.badRequest(
                    "leaderId is required when roundNumber is 0 (no approver)",
                );
            }

            const editorIdsForCheck = editorIds
                ?? membersBefore.filter((member) => member.role === "editor").map((member) => member.userId);
            validateLeaderNotEditor(editorIdsForCheck, effectiveLeaderId);
            await validateLeaderId(effectiveLeaderId);
        } else {
            const qc1UserIds = nextQcLevels?.[0]?.userIds
                ?? membersBefore.filter((member) => member.role === "qc1").map((member) => member.userId);
            const editorIdsForCheck = editorIds
                ?? membersBefore.filter((member) => member.role === "editor").map((member) => member.userId);

            if (input.leaderId) {
                await assertLeaderInQc1Level(input.leaderId, qc1UserIds, editorIdsForCheck);
                qcLeaderId = input.leaderId;
            } else if (nextQcLevels) {
                qcLeaderId = resolveQc1LeaderId(nextQcLevels, {
                    previousLeaderId: findLeaderUserId(membersBefore),
                });
            }
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
            if (input.projectCode !== undefined) {
                updates.projectCode = input.projectCode;
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

            if (nextQcLevels !== undefined) {
                await syncGroupQcs(tx, groupId, nextQcLevels, qcLeaderId);
            } else if (qcLeaderId) {
                await syncGroupLeader(tx, groupId, qcLeaderId);
            }

            if (willHaveNoApprover && effectiveLeaderId) {
                await syncGroupLeader(tx, groupId, effectiveLeaderId);
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

        const actorId = options?.actorUserId;
        if (!actorId) {
            throw httpError.badRequest("actorUserId is required to delete a group");
        }

        const blocking = await findBlockingDossiersForGroupDelete(db, groupId);
        assertGroupDeleteAllowed(blocking);

        const now = new Date();

        await db.transaction(async (tx) => {
            await cleanupReadyForEntryDossiersOnGroupDelete(tx, {
                groupId,
                actorId,
                now,
            });

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
        await assertGroupFoldersMatchProject(group, input.folderIds);

        await db
            .update(groups)
            .set({
                dossiersPerEditor: input.dossiersPerEditor,
                updatedAt: new Date(),
            })
            .where(eq(groups.id, groupId));

        const editorUserIds = await buildEditorRefsForGroup(group);

        return await runAssignByFolders(
            group,
            input.folderIds,
            input.dossiersPerEditor,
            editorUserIds,
            qcPeersByStep,
            actorId,
            "initial",
        );
    },

    async revokeByFolder(
        groupId: string,
        input: Static<typeof revokeByFolderFromGroupBodySchema>,
        actorId: string,
    ) {
        const group = await getActiveGroupOrThrow(groupId);
        const qcPeersByStep = await getActiveQcPeersByLevel(groupId, group.roundNumber);

        return await runRevokeByFolders(
            group,
            input.folderIds,
            qcPeersByStep,
            actorId,
        );
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
        await assertGroupFoldersMatchProject(group, input.folderIds);

        const editorUserIds = await buildEditorRefsForGroup(group);

        return await runAssignByFolders(
            group,
            input.folderIds,
            input.dossiersPerEditor,
            editorUserIds,
            qcPeersByStep,
            actorId,
            "continue",
        );
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
