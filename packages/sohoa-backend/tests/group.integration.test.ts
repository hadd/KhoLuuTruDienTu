import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierAssignments } from "../db/schemas/dossier-assignment.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { groupMembers } from "../db/schemas/group_members.ts";
import { groups } from "../db/schemas/groups.ts";
import { folders } from "../db/schemas/folder.ts";
import { userProfiles, userRoles } from "../db/schemas/index.ts";
import { ensureSeededRole } from "./test-role-helper.ts";
import {
    AssignmentStatus,
    DossierStatus,
    EntityType,
    WorkerRole,
} from "../db/schemas/workflow-constants.ts";
import { hashPassword } from "../libs/helpers/password.ts";
import { AuthRole } from "../modules/auth/auth-helper.ts";
import { GroupService } from "../modules/group/group-service.ts";
import { FolderService } from "../modules/folder/folder-service.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";

const TEST_PREFIX = `test-group/${crypto.randomUUID()}`;
const TEST_PASSWORD = "Test@sohoa2026";

function assertNoSensitiveGroupFields(value: unknown) {
    const json = JSON.stringify(value);
    assertEquals(json.includes("passwordHash"), false);
    assertEquals(json.includes("\"groupMembers\""), false);
    assertEquals(json.includes("\"metadataPermissionConfig\""), false);
}

type CreatedIds = {
    groupIds: string[];
    userIds: string[];
    folderIds: string[];
    dossierIds: string[];
    fileIds: string[];
};

async function createTestUser(input: { email: string; fullName: string; roleId: string }) {
    let profile = await db.query.userProfiles.findFirst({
        where: and(eq(userProfiles.email, input.email), isNull(userProfiles.deletedAt)),
    });

    if (!profile) {
        const passwordHash = await hashPassword(TEST_PASSWORD);
        [profile] = await db.insert(userProfiles).values({
            email: input.email,
            fullName: input.fullName,
            passwordHash,
        }).returning();
    }

    const hasRole = await db.query.userRoles.findFirst({
        where: and(
            eq(userRoles.userId, profile.id),
            eq(userRoles.roleId, input.roleId),
            isNull(userRoles.expiredAt),
        ),
    });
    if (!hasRole) {
        await db.insert(userRoles).values({ userId: profile.id, roleId: input.roleId });
    }

    return profile;
}

async function cleanupTestData(ids: CreatedIds) {
    if (ids.fileIds.length > 0) {
        await db.delete(dossierFiles).where(inArray(dossierFiles.id, ids.fileIds));
    }
    if (ids.dossierIds.length > 0) {
        await db.delete(dossierAssignments).where(
            inArray(dossierAssignments.dossierId, ids.dossierIds),
        );
        await db.delete(dossiers).where(inArray(dossiers.id, ids.dossierIds));
    }
    if (ids.folderIds.length > 0) {
        await db.delete(folders).where(inArray(folders.id, ids.folderIds));
    }
    if (ids.groupIds.length > 0) {
        await db.delete(groupMembers).where(inArray(groupMembers.groupId, ids.groupIds));
        await db.delete(groups).where(inArray(groups.id, ids.groupIds));
    }
}

Deno.test({
    name: "Group Integration Tests",
    sanitizeResources: false,
    sanitizeOps: false,
    fn: async (t) => {
    const project = await createTestProject();
    const projectCode = project.projectCode;
    const ids: CreatedIds = {
        groupIds: [],
        userIds: [],
        folderIds: [],
        dossierIds: [],
        fileIds: [],
    };

    await ensureSeededRole(AuthRole.EDITOR, "Editor");
    await ensureSeededRole(AuthRole.QC, "QC");

    const editor1 = await createTestUser({
        email: `${TEST_PREFIX}-editor1@test.local`,
        fullName: "Test Editor 1",
        roleId: AuthRole.EDITOR,
    });
    const editor2 = await createTestUser({
        email: `${TEST_PREFIX}-editor2@test.local`,
        fullName: "Test Editor 2",
        roleId: AuthRole.EDITOR,
    });
    const qc1 = await createTestUser({
        email: `${TEST_PREFIX}-qc1@test.local`,
        fullName: "Test QC 1",
        roleId: AuthRole.QC,
    });
    const qc2 = await createTestUser({
        email: `${TEST_PREFIX}-qc2@test.local`,
        fullName: "Test QC 2",
        roleId: AuthRole.QC,
    });
    const editorNoQc = await createTestUser({
        email: `${TEST_PREFIX}-editor-no-qc@test.local`,
        fullName: "Test Editor No QC",
        roleId: AuthRole.EDITOR,
    });
    const editorMulti = await createTestUser({
        email: `${TEST_PREFIX}-editor-multi@test.local`,
        fullName: "Test Editor Multi QC",
        roleId: AuthRole.EDITOR,
    });
    const qc3 = await createTestUser({
        email: `${TEST_PREFIX}-qc3@test.local`,
        fullName: "Test QC 3",
        roleId: AuthRole.QC,
    });
    const qc4 = await createTestUser({
        email: `${TEST_PREFIX}-qc4@test.local`,
        fullName: "Test QC 4",
        roleId: AuthRole.QC,
    });
    ids.userIds.push(
        editor1.id,
        editor2.id,
        qc1.id,
        qc2.id,
        editorNoQc.id,
        editorMulti.id,
        qc3.id,
        qc4.id,
    );

    const actorId = editor1.id;

    try {
        let groupId = "";

        await t.step("create group without approver requires explicit leader", async () => {
            const { record } = await GroupService.create({
                name: `No QC ${TEST_PREFIX}`,
                projectCode,
                roundNumber: 0,
                editorIds: [editorNoQc.id],
                leaderId: qc1.id,
            });
            ids.groupIds.push(record.id);

            assertEquals(record.roundNumber, 0);
            assertEquals(record.qcs.length, 0);
            assertEquals(record.leader?.userId, qc1.id);

            const members = await db.query.groupMembers.findMany({
                where: and(
                    eq(groupMembers.groupId, record.id),
                    isNull(groupMembers.expiredAt),
                ),
            });
            assertEquals(members.some((member) => member.role === "leader"), true);
            assertEquals(members.some((member) => member.role === "qc1"), false);
        });

        await t.step("create group with editors, qcs, and leader", async () => {
            const { record } = await GroupService.create({
                name: `Group ${TEST_PREFIX}`,
                projectCode,
                roundNumber: 2,
                editorIds: [editor1.id, editor2.id],
                qcLevels: [{ userIds: [qc1.id] }, { userIds: [qc2.id] }],
            });

            groupId = record.id;
            ids.groupIds.push(groupId);

            assertEquals(record.roundNumber, 2);
            assertEquals(record.projectCode, projectCode);
            assertEquals(record.editors.length, 2);
            assertEquals(record.qcs.length, 2);
            assertEquals(record.qcs[0]?.role, "qc1");
            assertEquals(record.qcs[1]?.role, "qc2");
            assertEquals(record.leader?.userId, qc1.id);

            const members = await db.query.groupMembers.findMany({
                where: and(
                    eq(groupMembers.groupId, groupId),
                    isNull(groupMembers.expiredAt),
                ),
            });

            const rolesPresent = new Set(members.map((m) => m.role));
            assertEquals(rolesPresent.has("editor"), true);
            assertEquals(rolesPresent.has("qc1"), true);
            assertEquals(rolesPresent.has("qc2"), true);
            assertEquals(rolesPresent.has("leader"), true);
        });

        await t.step("list unassigned editors excludes group members", async () => {
            const unassignedEditor = await createTestUser({
                email: `${TEST_PREFIX}-unassigned@test.local`,
                fullName: "Unassigned Editor",
                roleId: AuthRole.EDITOR,
            });
            ids.userIds.push(unassignedEditor.id);

            const { items } = await GroupService.listUnassignedEditors();
            const userIds = new Set(items.map((item) => item.userId));

            assertEquals(userIds.has(unassignedEditor.id), true);
            assertEquals(userIds.has(editor1.id), false);
            assertEquals(userIds.has(editor2.id), false);
        });

        await t.step("list returns only member groups for non-admin scope", async () => {
            const memberList = await GroupService.listSummary({ memberUserId: editor1.id });
            assertEquals(memberList.items.some((group) => group.id === groupId), true);

            const outsider = await createTestUser({
                email: `${TEST_PREFIX}-outsider@test.local`,
                fullName: "Test Outsider",
                roleId: AuthRole.EDITOR,
            });
            ids.userIds.push(outsider.id);

            const outsiderList = await GroupService.listSummary({ memberUserId: outsider.id });
            assertEquals(outsiderList.items.some((group) => group.id === groupId), false);

            const allList = await GroupService.listSummary();
            assertEquals(allList.items.some((group) => group.id === groupId), true);
        });

        await t.step("list with empty projectCodes blocks results even for members", async () => {
            const blocked = await GroupService.listSummary({
                projectCodes: [],
                memberUserId: editor1.id,
            });
            assertEquals(blocked.items.length, 0);
            assertEquals(blocked.total, 0);
            assertEquals(blocked.totalPages, 0);

            const memberOnly = await GroupService.listSummary({ memberUserId: editor1.id });
            assertEquals(memberOnly.items.some((group) => group.id === groupId), true);
        });

        await t.step("listSummary returns pagination, counts, and no sensitive fields", async () => {
            const summary = await GroupService.listSummary({
                search: `Group ${TEST_PREFIX}`,
            });
            assertEquals(summary.total >= 1, true);
            assertEquals(summary.page, 1);
            assertEquals(summary.limit, 20);
            assertEquals(summary.totalPages >= 1, true);

            const target = summary.items.find((group) => group.id === groupId);
            assertExists(target);
            assertEquals(target.editorCount, 2);
            assertEquals(target.qcCount, 2);
            assertEquals(target.memberCount, 4);
            assertEquals(target.leader?.userId, qc1.id);
            assertEquals("editors" in target, false);
            assertEquals("permissionConfig" in target, false);
            assertNoSensitiveGroupFields(summary);
        });

        await t.step("listSummary filters by projectCode", async () => {
            const result = await GroupService.listSummary({ projectCode });
            assertEquals(
                result.items.every((group) => group.projectCode === projectCode),
                true,
            );
            assertEquals(result.items.some((group) => group.id === groupId), true);
        });

        await t.step("get returns detail without sensitive duplicate fields", async () => {
            const { record } = await GroupService.get(groupId);
            assertExists(record.qcLevels);
            assertEquals(record.editors.length, 2);
            assertEquals(
                record.editors.every((editor) => "permissionSlotCode" in editor),
                true,
            );
            assertExists(record.projectName);
            assertEquals(record.permissionConfig === null || typeof record.permissionConfig === "object", true);
            assertNoSensitiveGroupFields(record);
        });

        await t.step("create group with multiple qc1 and qc2 peers", async () => {
            const { record } = await GroupService.create({
                name: `Multi QC ${TEST_PREFIX}`,
                projectCode,
                roundNumber: 2,
                editorIds: [editorMulti.id],
                qcLevels: [
                    { userIds: [qc1.id, qc3.id] },
                    { userIds: [qc2.id, qc4.id] },
                ],
                leaderId: qc3.id,
            });
            ids.groupIds.push(record.id);

            assertEquals(record.qcLevels[0]?.members.length, 2);
            assertEquals(record.qcLevels[1]?.members.length, 2);
            assertEquals(record.leader?.userId, qc3.id);

            const multiPath = `${TEST_PREFIX}/multi-qc`;
            const multiFolder = await FolderService.create({
                folderPath: multiPath,
                folderName: "multi-qc",
                projectCode,
            });
            ids.folderIds.push(multiFolder.id);

            const multiDossierNames = ["multi-ho-so-1", "multi-ho-so-2"];
            for (const name of multiDossierNames) {
                const [row] = await db.insert(dossiers).values({
                    folderId: multiFolder.id,
                    folderPath: multiPath,
                    name,
                    entityType: EntityType.DOCUMENT,
                }).returning();
                ids.dossierIds.push(row.id);
                const [file] = await db.insert(dossierFiles).values({
                    dossierId: row.id,
                    fileName: "scan.pdf",
                    filePath: `${multiPath}/${name}/scan.pdf`,
                    fileSizeKb: 10,
                }).returning();
                ids.fileIds.push(file.id);
            }

            const assignResult = await GroupService.assignByFolder(
                record.id,
                { folderIds: [multiFolder.id], dossiersPerEditor: 5 },
                actorId,
            );
            assertEquals(assignResult.totalAssigned, 2);

            const checker1 = await db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, ids.dossierIds.slice(-2)),
                    eq(dossierAssignments.role, WorkerRole.CHECKER_1),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ),
            });
            const checker2 = await db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, ids.dossierIds.slice(-2)),
                    eq(dossierAssignments.role, WorkerRole.CHECKER_2),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ),
            });

            assertEquals(checker1.length, 2);
            assertEquals(checker2.length, 2);

            const checker1Assignees = new Set(checker1.map((row) => row.assigneeId));
            const checker2Assignees = new Set(checker2.map((row) => row.assigneeId));
            assertEquals(checker1Assignees.has(qc1.id), true);
            assertEquals(checker1Assignees.has(qc3.id), true);
            assertEquals(checker2Assignees.has(qc2.id), true);
            assertEquals(checker2Assignees.has(qc4.id), true);
        });

        await t.step("allow QC to belong to multiple groups", async () => {
            const editor3 = await createTestUser({
                email: `${TEST_PREFIX}-editor3@test.local`,
                fullName: "Test Editor 3",
                roleId: AuthRole.EDITOR,
            });
            ids.userIds.push(editor3.id);

            const qc3 = await createTestUser({
                email: `${TEST_PREFIX}-qc3@test.local`,
                fullName: "Test QC 3",
                roleId: AuthRole.QC,
            });
            ids.userIds.push(qc3.id);

            const { record: otherGroup } = await GroupService.create({
                name: `Other ${TEST_PREFIX}`,
                projectCode,
                roundNumber: 2,
                editorIds: [editor3.id],
                qcLevels: [{ userIds: [qc1.id] }, { userIds: [qc3.id] }],
            });
            ids.groupIds.push(otherGroup.id);

            assertEquals(otherGroup.qcs.length, 2);
            assertEquals(otherGroup.qcs[0]?.userId, qc1.id);
        });

        const leafPath = `${TEST_PREFIX}/leaf`;
        const leafFolder = await FolderService.create({
            folderPath: leafPath,
            folderName: "leaf",
            projectCode,
        });
        ids.folderIds.push(leafFolder.id);

        const [dossier] = await db.insert(dossiers).values({
            folderId: leafFolder.id,
            folderPath: leafPath,
            name: "ho-so-group-test",
            entityType: EntityType.DOCUMENT,
        }).returning();
        ids.dossierIds.push(dossier.id);

        const [file] = await db.insert(dossierFiles).values({
            dossierId: dossier.id,
            fileName: "scan.pdf",
            filePath: `${leafPath}/ho-so-group-test/scan.pdf`,
            fileSizeKb: 10,
        }).returning();
        ids.fileIds.push(file.id);

        await t.step("assign-by-folder creates MAKER and CHECKER assignments", async () => {
            const result = await GroupService.assignByFolder(
                groupId,
                { folderIds: [leafFolder.id], dossiersPerEditor: 5 },
                actorId,
            );

            assertEquals(result.totalAssigned, 1);
            assertEquals(result.checkerAssignmentsCreated, 2);

            const assignments = await db.query.dossierAssignments.findMany({
                where: and(
                    eq(dossierAssignments.dossierId, dossier.id),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ),
            });

            const maker = assignments.find((a) => a.role === WorkerRole.MAKER);
            const checker1 = assignments.find((a) => a.role === WorkerRole.CHECKER_1);
            const checker2 = assignments.find((a) => a.role === WorkerRole.CHECKER_2);

            assertExists(maker);
            assertExists(checker1);
            assertExists(checker2);
            assertEquals(checker1.assigneeId, qc1.id);
            assertEquals(checker2.assigneeId, qc2.id);
            assertEquals(checker1.stepNumber, 1);
            assertEquals(checker2.stepNumber, 2);

            const updatedDossier = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, dossier.id),
            });
            assertEquals(updatedDossier?.requiredQcCount, 2);
            assertEquals(updatedDossier?.assignedGroupId, groupId);
            assertEquals(result.dossiersQcCountUpdated, 1);
            assertEquals(result.queueSummary.active, 1);
            assertEquals(result.queueSummary.queued, 0);

            const groupRow = await db.query.groups.findFirst({
                where: eq(groups.id, groupId),
            });
            assertEquals(groupRow?.dossiersPerEditor, 5);
        });

        await t.step("revoke-by-folder cancels assignments for unstarted dossiers", async () => {
            const revokePath = `${TEST_PREFIX}/revoke`;
            const revokeFolder = await FolderService.create({
                folderPath: revokePath,
                folderName: "revoke",
                projectCode,
            });
            ids.folderIds.push(revokeFolder.id);

            const [revokeDossier] = await db.insert(dossiers).values({
                folderId: revokeFolder.id,
                folderPath: revokePath,
                name: "ho-so-revoke",
                entityType: EntityType.DOCUMENT,
                status: DossierStatus.READY_FOR_ENTRY,
            }).returning();
            ids.dossierIds.push(revokeDossier.id);

            const [revokeFile] = await db.insert(dossierFiles).values({
                dossierId: revokeDossier.id,
                fileName: "scan.pdf",
                filePath: `${revokePath}/ho-so-revoke/scan.pdf`,
                fileSizeKb: 10,
            }).returning();
            ids.fileIds.push(revokeFile.id);

            const assignResult = await GroupService.assignByFolder(
                groupId,
                { folderIds: [revokeFolder.id], dossiersPerEditor: 5 },
                actorId,
            );
            assertEquals(assignResult.totalAssigned, 1);

            const revokeResult = await GroupService.revokeByFolder(
                groupId,
                { folderIds: [revokeFolder.id] },
                actorId,
            );

            assertEquals(revokeResult.skipped, []);
            assertEquals(revokeResult.totalRevoked, 1);
            assertEquals(revokeResult.revokedDossierIds, [revokeDossier.id]);
            assertEquals(revokeResult.assignmentsCancelled > 0, true);

            const activeAssignments = await db.query.dossierAssignments.findMany({
                where: and(
                    eq(dossierAssignments.dossierId, revokeDossier.id),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ),
            });
            assertEquals(activeAssignments.length, 0);

            const updated = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, revokeDossier.id),
            });
            assertEquals(updated?.assignedGroupId, null);
        });

        await t.step("revoke-by-folder revokes dossiers already in ENTRY_PROCESSING", async () => {
            const busyPath = `${TEST_PREFIX}/revoke-busy`;
            const busyFolder = await FolderService.create({
                folderPath: busyPath,
                folderName: "revoke-busy",
                projectCode,
            });
            ids.folderIds.push(busyFolder.id);

            const [busyDossier] = await db.insert(dossiers).values({
                folderId: busyFolder.id,
                folderPath: busyPath,
                name: "ho-so-busy",
                entityType: EntityType.DOCUMENT,
            }).returning();
            ids.dossierIds.push(busyDossier.id);

            const [busyFile] = await db.insert(dossierFiles).values({
                dossierId: busyDossier.id,
                fileName: "scan.pdf",
                filePath: `${busyPath}/ho-so-busy/scan.pdf`,
                fileSizeKb: 10,
            }).returning();
            ids.fileIds.push(busyFile.id);

            await GroupService.assignByFolder(
                groupId,
                { folderIds: [busyFolder.id], dossiersPerEditor: 5 },
                actorId,
            );

            await db
                .update(dossiers)
                .set({ status: DossierStatus.ENTRY_PROCESSING })
                .where(eq(dossiers.id, busyDossier.id));

            const revokeResult = await GroupService.revokeByFolder(
                groupId,
                { folderIds: [busyFolder.id] },
                actorId,
            );

            assertEquals(revokeResult.skipped, []);
            assertEquals(revokeResult.totalRevoked, 1);
            assertEquals(revokeResult.revokedDossierIds, [busyDossier.id]);
            assertEquals(revokeResult.assignmentsCancelled > 0, true);

            const activeAssignments = await db.query.dossierAssignments.findMany({
                where: and(
                    eq(dossierAssignments.dossierId, busyDossier.id),
                    inArray(dossierAssignments.status, [
                        AssignmentStatus.IN_PROGRESS,
                        AssignmentStatus.DRAFT,
                    ]),
                ),
            });
            assertEquals(activeAssignments.length, 0);

            const updated = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, busyDossier.id),
            });
            assertEquals(updated?.assignedGroupId, null);
            assertEquals(updated?.status, DossierStatus.READY_FOR_ENTRY);
        });

        await t.step("revoke-by-member revokes READY_FOR_ENTRY and ENTRY_PROCESSING for one editor", async () => {
            const memberPath = `${TEST_PREFIX}/revoke-member`;
            const memberFolder = await FolderService.create({
                folderPath: memberPath,
                folderName: "revoke-member",
                projectCode,
            });
            ids.folderIds.push(memberFolder.id);

            const memberDossierIds: string[] = [];
            for (const name of ["ho-so-ready", "ho-so-busy", "ho-so-qc"]) {
                const [row] = await db.insert(dossiers).values({
                    folderId: memberFolder.id,
                    folderPath: memberPath,
                    name,
                    entityType: EntityType.DOCUMENT,
                    status: DossierStatus.READY_FOR_ENTRY,
                }).returning();
                memberDossierIds.push(row.id);
                ids.dossierIds.push(row.id);

                const [file] = await db.insert(dossierFiles).values({
                    dossierId: row.id,
                    fileName: "scan.pdf",
                    filePath: `${memberPath}/${name}/scan.pdf`,
                    fileSizeKb: 10,
                }).returning();
                ids.fileIds.push(file.id);
            }

            const [readyId, busyId, qcId] = memberDossierIds;

            await GroupService.assignByFolder(
                groupId,
                { folderIds: [memberFolder.id], dossiersPerEditor: 5 },
                actorId,
            );

            const makers = await db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, memberDossierIds),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ),
            });
            assertEquals(makers.length, 3);

            // Force all three onto editor1 so revoke-by-member targets a single user.
            await db
                .update(dossierAssignments)
                .set({ assigneeId: editor1.id })
                .where(and(
                    inArray(dossierAssignments.dossierId, memberDossierIds),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ));

            await db
                .update(dossiers)
                .set({ status: DossierStatus.ENTRY_PROCESSING })
                .where(eq(dossiers.id, busyId));
            await db
                .update(dossiers)
                .set({ status: DossierStatus.WAITING_CHECKER_1 })
                .where(eq(dossiers.id, qcId));

            const revokeResult = await GroupService.revokeByMember(
                groupId,
                { userId: editor1.id },
                actorId,
            );

            assertEquals(revokeResult.totalRevoked, 2);
            assertEquals(
                [...revokeResult.revokedDossierIds].sort(),
                [readyId, busyId].sort(),
            );
            assertEquals(revokeResult.totalSkipped, 1);
            assertEquals(
                revokeResult.skipped[0]?.reason,
                "Dossier has already started or completed processing",
            );
            assertEquals(revokeResult.assignmentsCancelled >= 2, true);

            const editor1Active = await db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, [readyId, busyId]),
                    eq(dossierAssignments.assigneeId, editor1.id),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    inArray(dossierAssignments.status, [
                        AssignmentStatus.IN_PROGRESS,
                        AssignmentStatus.DRAFT,
                    ]),
                ),
            });
            assertEquals(editor1Active.length, 0);

            const readyAfter = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, readyId),
            });
            const busyAfter = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, busyId),
            });
            const qcAfter = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, qcId),
            });

            assertEquals(readyAfter?.assignedGroupId, groupId);
            assertEquals(busyAfter?.assignedGroupId, groupId);
            assertEquals(busyAfter?.status, DossierStatus.READY_FOR_ENTRY);
            assertEquals(qcAfter?.status, DossierStatus.WAITING_CHECKER_1);
            assertEquals(qcAfter?.assignedGroupId, groupId);
        });

        await t.step("assign-by-folder accepts multiple folderIds in one request", async () => {
            const folderPaths = [`${TEST_PREFIX}/batch-a`, `${TEST_PREFIX}/batch-b`];
            const batchFolderIds: string[] = [];
            const batchDossierIds: string[] = [];

            for (const [index, folderPath] of folderPaths.entries()) {
                const folder = await FolderService.create({
                    folderPath,
                    folderName: `batch-${index + 1}`,
                    projectCode,
                });
                batchFolderIds.push(folder.id);
                ids.folderIds.push(folder.id);

                const [row] = await db.insert(dossiers).values({
                    folderId: folder.id,
                    folderPath,
                    name: `ho-so-batch-${index + 1}`,
                    entityType: EntityType.DOCUMENT,
                }).returning();
                batchDossierIds.push(row.id);
                ids.dossierIds.push(row.id);

                const [file] = await db.insert(dossierFiles).values({
                    dossierId: row.id,
                    fileName: "scan.pdf",
                    filePath: `${folderPath}/ho-so-batch-${index + 1}/scan.pdf`,
                    fileSizeKb: 10,
                }).returning();
                ids.fileIds.push(file.id);
            }

            const result = await GroupService.assignByFolder(
                groupId,
                { folderIds: batchFolderIds, dossiersPerEditor: 5 },
                actorId,
            );

            assertEquals(result.totalAssigned, 2);
            assertEquals(result.folderResults?.length, 2);
            assertEquals(result.folderResults?.[0]?.totalAssigned, 1);
            assertEquals(result.folderResults?.[1]?.totalAssigned, 1);

            const makers = await db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, batchDossierIds),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ),
            });
            assertEquals(makers.length, 2);
            assertEquals(new Set(makers.map((row) => row.assigneeId)).size, 2);
        });

        await t.step("assign-by-folder round-robins all dossiers without queueing leftovers", async () => {
            const queuePath = `${TEST_PREFIX}/queue`;
            const queueFolder = await FolderService.create({
                folderPath: queuePath,
                folderName: "queue",
                projectCode,
            });
            ids.folderIds.push(queueFolder.id);

            const dossierNames = ["q-ho-so-1", "q-ho-so-2", "q-ho-so-3"];
            const queueDossierIds: string[] = [];
            for (const name of dossierNames) {
                const [row] = await db.insert(dossiers).values({
                    folderId: queueFolder.id,
                    folderPath: queuePath,
                    name,
                    entityType: EntityType.DOCUMENT,
                }).returning();
                ids.dossierIds.push(row.id);
                queueDossierIds.push(row.id);
                const [file] = await db.insert(dossierFiles).values({
                    dossierId: row.id,
                    fileName: "scan.pdf",
                    filePath: `${queuePath}/${name}/scan.pdf`,
                    fileSizeKb: 10,
                }).returning();
                ids.fileIds.push(file.id);
            }

            const assignResult = await GroupService.assignByFolder(
                groupId,
                { folderIds: [queueFolder.id], dossiersPerEditor: 1 },
                actorId,
            );

            assertEquals(assignResult.totalAssigned, 3);
            assertEquals(assignResult.queueSummary.active, 3);
            assertEquals(assignResult.queueSummary.queued, 0);

            const makers = await db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, queueDossierIds),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ),
            });
            assertEquals(makers.length, 3);
            const countByEditor = new Map<string, number>();
            for (const row of makers) {
                countByEditor.set(row.assigneeId, (countByEditor.get(row.assigneeId) ?? 0) + 1);
            }
            assertEquals(
                [countByEditor.get(editor1.id) ?? 0, countByEditor.get(editor2.id) ?? 0].sort(),
                [1, 2],
            );

            const queueView = await GroupService.getFolderQueue(groupId, queueFolder.id);
            assertEquals(queueView.queued.length, 0);

            await assertRejects(
                () =>
                    GroupService.continueAssignByFolder(
                        groupId,
                        { folderIds: [queueFolder.id], dossiersPerEditor: 1 },
                        actorId,
                    ),
                Error,
                "Chưa có biên tập nào hoàn thành",
            );
        });

        await t.step("assign-by-folder round-robins across multiple folders", async () => {
            const splitFolderIds: string[] = [];
            const splitDossierIds: string[] = [];

            for (let index = 1; index <= 3; index++) {
                const folderPath = `${TEST_PREFIX}/rr-folder-${index}`;
                const folder = await FolderService.create({
                    folderPath,
                    folderName: `rr-folder-${index}`,
                    projectCode,
                });
                ids.folderIds.push(folder.id);
                splitFolderIds.push(folder.id);

                const [row] = await db.insert(dossiers).values({
                    folderId: folder.id,
                    folderPath,
                    name: `rr-ho-so-${index}`,
                    entityType: EntityType.DOCUMENT,
                }).returning();
                ids.dossierIds.push(row.id);
                splitDossierIds.push(row.id);
                const [file] = await db.insert(dossierFiles).values({
                    dossierId: row.id,
                    fileName: "scan.pdf",
                    filePath: `${folderPath}/rr-ho-so-${index}/scan.pdf`,
                    fileSizeKb: 10,
                }).returning();
                ids.fileIds.push(file.id);
            }

            const result = await GroupService.assignByFolder(
                groupId,
                { folderIds: splitFolderIds, dossiersPerEditor: 1 },
                actorId,
            );

            assertEquals(result.totalAssigned, 3);
            assertEquals(result.queueSummary.queued, 0);

            const makers = await db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, splitDossierIds),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ),
            });
            assertEquals(makers.length, 3);
            const countByEditor = new Map<string, number>();
            for (const row of makers) {
                countByEditor.set(row.assigneeId, (countByEditor.get(row.assigneeId) ?? 0) + 1);
            }
            assertEquals(
                [countByEditor.get(editor1.id) ?? 0, countByEditor.get(editor2.id) ?? 0].sort(),
                [1, 2],
            );
        });

        await t.step("assign-by-folder splits 5 dossiers across 3 editors as 2-2-1", async () => {
            const splitEditors = await Promise.all(
                ["a", "b", "c"].map((suffix) =>
                    createTestUser({
                        email: `${TEST_PREFIX}-split-${suffix}@test.local`,
                        fullName: `Split Editor ${suffix}`,
                        roleId: AuthRole.EDITOR,
                    })
                ),
            );
            for (const editor of splitEditors) {
                ids.userIds.push(editor.id);
            }

            const { record: splitGroup } = await GroupService.create({
                name: `Split 3 ${TEST_PREFIX}`,
                projectCode,
                roundNumber: 1,
                editorIds: splitEditors.map((editor) => editor.id),
                qcLevels: [{ userIds: [qc1.id] }],
            });
            ids.groupIds.push(splitGroup.id);

            const folderPath = `${TEST_PREFIX}/split-5`;
            const folder = await FolderService.create({
                folderPath,
                folderName: "split-5",
                projectCode,
            });
            ids.folderIds.push(folder.id);

            const splitDossierIds: string[] = [];
            for (let index = 1; index <= 5; index++) {
                const [row] = await db.insert(dossiers).values({
                    folderId: folder.id,
                    folderPath,
                    name: `split-ho-so-${index}`,
                    entityType: EntityType.DOCUMENT,
                }).returning();
                ids.dossierIds.push(row.id);
                splitDossierIds.push(row.id);
                const [file] = await db.insert(dossierFiles).values({
                    dossierId: row.id,
                    fileName: "scan.pdf",
                    filePath: `${folderPath}/split-ho-so-${index}/scan.pdf`,
                    fileSizeKb: 10,
                }).returning();
                ids.fileIds.push(file.id);
            }

            const result = await GroupService.assignByFolder(
                splitGroup.id,
                { folderIds: [folder.id], dossiersPerEditor: 1 },
                actorId,
            );

            assertEquals(result.totalAssigned, 5);
            assertEquals(result.queueSummary.queued, 0);
            assertEquals(result.queueSummary.active, 5);

            const makers = await db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, splitDossierIds),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ),
            });
            assertEquals(makers.length, 5);
            const counts = splitEditors
                .map((editor) => makers.filter((row) => row.assigneeId === editor.id).length)
                .sort();
            assertEquals(counts, [1, 2, 2]);
        });

        await t.step("assignment-counts and member-assignments for editor/QC", async () => {
            const countsPath = `${TEST_PREFIX}/member-assignments`;
            const countsFolder = await FolderService.create({
                folderPath: countsPath,
                folderName: "member-assignments",
                projectCode,
            });
            ids.folderIds.push(countsFolder.id);

            const dossierNames = ["ma-ho-so-1", "ma-ho-so-2"];
            const createdDossierIds: string[] = [];
            for (const name of dossierNames) {
                const [row] = await db.insert(dossiers).values({
                    folderId: countsFolder.id,
                    folderPath: countsPath,
                    name,
                    entityType: EntityType.DOCUMENT,
                }).returning();
                ids.dossierIds.push(row.id);
                createdDossierIds.push(row.id);
                const [file] = await db.insert(dossierFiles).values({
                    dossierId: row.id,
                    fileName: "scan.pdf",
                    filePath: `${countsPath}/${name}/scan.pdf`,
                    fileSizeKb: 10,
                }).returning();
                ids.fileIds.push(file.id);
            }

            await GroupService.assignByFolder(
                groupId,
                { folderIds: [countsFolder.id], dossiersPerEditor: 5 },
                actorId,
            );

            // Force both new dossiers onto editor1 as active MAKER work.
            await db
                .update(dossierAssignments)
                .set({ assigneeId: editor1.id })
                .where(and(
                    inArray(dossierAssignments.dossierId, createdDossierIds),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    inArray(dossierAssignments.status, [
                        AssignmentStatus.IN_PROGRESS,
                        AssignmentStatus.DRAFT,
                    ]),
                ));

            await db
                .update(dossiers)
                .set({ status: DossierStatus.ENTRY_PROCESSING })
                .where(inArray(dossiers.id, createdDossierIds));

            const countsWhileEditing = await GroupService.getAssignmentCounts(groupId);
            const editor1Count = countsWhileEditing.editors.find(
                (row) => row.userId === editor1.id,
            );
            assertExists(editor1Count);
            assertEquals(editor1Count.count >= 2, true);

            const editorList = await GroupService.getMemberAssignments(groupId, {
                userId: editor1.id,
                kind: "editor",
            });
            assertEquals(
                editorList.dossiers.filter((d) => createdDossierIds.includes(d.id)).length,
                2,
            );

            // Checker shows dossiers as soon as CHECKER_N is assigned, even while ENTRY_PROCESSING.
            const qcWhileEditing = await GroupService.getMemberAssignments(groupId, {
                userId: qc1.id,
                kind: "checker",
                level: 1,
            });
            assertEquals(
                qcWhileEditing.dossiers.filter((d) => createdDossierIds.includes(d.id)).length,
                2,
            );

            const qcCountWhileEditing = countsWhileEditing.checkers.find(
                (row) => row.userId === qc1.id && row.level === 1,
            );
            assertExists(qcCountWhileEditing);
            assertEquals(qcCountWhileEditing.count >= 2, true);
            assertEquals(
                qcWhileEditing.total,
                qcCountWhileEditing.count,
            );

            const assignedList = await GroupService.getAssignedDossiers(groupId);
            const assignedCreated = assignedList.dossiers.filter((d) =>
                createdDossierIds.includes(d.id)
            );
            assertEquals(assignedCreated.length, 2);
            for (const dossier of assignedCreated) {
                assertEquals(dossier.editors.length >= 1, true);
                assertEquals(
                    dossier.editors.some((editor) => editor.userId === editor1.id),
                    true,
                );
            }
        });

        await t.step("assigned-dossiers includes makers and empty editors for queued", async () => {
            const listEditor = await createTestUser({
                email: `${TEST_PREFIX}-list-editor@test.local`,
                fullName: "List Editor",
                roleId: AuthRole.EDITOR,
            });
            ids.userIds.push(listEditor.id);

            const { record: listGroup } = await GroupService.create({
                name: `List Assigned ${TEST_PREFIX}`,
                projectCode,
                roundNumber: 1,
                editorIds: [listEditor.id],
                qcLevels: [{ userIds: [qc1.id] }],
            });
            ids.groupIds.push(listGroup.id);

            const listPath = `${TEST_PREFIX}/assigned-dossiers-list`;
            const listFolder = await FolderService.create({
                folderPath: listPath,
                folderName: "assigned-dossiers-list",
                projectCode,
            });
            ids.folderIds.push(listFolder.id);

            const [activeDossier] = await db.insert(dossiers).values({
                folderId: listFolder.id,
                folderPath: listPath,
                name: "list-active",
                entityType: EntityType.DOCUMENT,
                assignedGroupId: listGroup.id,
            }).returning();
            ids.dossierIds.push(activeDossier.id);

            const [queuedDossier] = await db.insert(dossiers).values({
                folderId: listFolder.id,
                folderPath: listPath,
                name: "list-queued",
                entityType: EntityType.DOCUMENT,
                assignedGroupId: listGroup.id,
            }).returning();
            ids.dossierIds.push(queuedDossier.id);

            await db.insert(dossierAssignments).values({
                dossierId: activeDossier.id,
                assigneeId: listEditor.id,
                role: WorkerRole.MAKER,
                status: AssignmentStatus.IN_PROGRESS,
            });

            const assignedList = await GroupService.getAssignedDossiers(listGroup.id);
            assertEquals(assignedList.total, 2);

            const activeRow = assignedList.dossiers.find((d) => d.id === activeDossier.id);
            const queuedRow = assignedList.dossiers.find((d) => d.id === queuedDossier.id);
            assertExists(activeRow);
            assertExists(queuedRow);
            assertEquals(activeRow.editors.length, 1);
            assertEquals(activeRow.editors[0]?.userId, listEditor.id);
            assertEquals(activeRow.editors[0]?.fullName, "List Editor");
            assertEquals(queuedRow.editors.length, 0);
        });
    } finally {
        await cleanupTestData(ids);
        await deleteTestProject(projectCode);
    }
    },
});
