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

Deno.test("Group Integration Tests", async (t) => {
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
            }).returning();
            ids.dossierIds.push(revokeDossier.id);

            const [revokeFile] = await db.insert(dossierFiles).values({
                dossierId: revokeDossier.id,
                fileName: "scan.pdf",
                filePath: `${revokePath}/ho-so-revoke/scan.pdf`,
                fileSizeKb: 10,
            }).returning();
            ids.fileIds.push(revokeFile.id);

            await GroupService.assignByFolder(
                groupId,
                { folderIds: [revokeFolder.id], dossiersPerEditor: 5 },
                actorId,
            );

            const revokeResult = await GroupService.revokeByFolder(
                groupId,
                { folderIds: [revokeFolder.id] },
                actorId,
            );

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

        await t.step("revoke-by-folder skips dossiers already in ENTRY_PROCESSING", async () => {
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

            assertEquals(revokeResult.totalRevoked, 0);
            assertEquals(revokeResult.totalSkipped, 1);
            assertEquals(
                revokeResult.skipped[0]?.reason,
                "Dossier has already started or completed processing",
            );

            const stillAssigned = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, busyDossier.id),
            });
            assertEquals(stillAssigned?.assignedGroupId, groupId);
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
        });

        await t.step("queue: 3 dossiers, 2 editors, 1 per editor leaves 1 queued", async () => {
            const queuePath = `${TEST_PREFIX}/queue`;
            const queueFolder = await FolderService.create({
                folderPath: queuePath,
                folderName: "queue",
                projectCode,
            });
            ids.folderIds.push(queueFolder.id);

            const dossierNames = ["q-ho-so-1", "q-ho-so-2", "q-ho-so-3"];
            for (const name of dossierNames) {
                const [row] = await db.insert(dossiers).values({
                    folderId: queueFolder.id,
                    folderPath: queuePath,
                    name,
                    entityType: EntityType.DOCUMENT,
                }).returning();
                ids.dossierIds.push(row.id);
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

            assertEquals(assignResult.totalAssigned, 2);
            assertEquals(assignResult.queueSummary.active, 2);
            assertEquals(assignResult.queueSummary.queued, 1);

            const queueView = await GroupService.getFolderQueue(groupId, queueFolder.id);
            assertEquals(queueView.queued.length, 1);

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

            const queueDossierIds = await db.query.dossiers.findMany({
                where: and(
                    eq(dossiers.folderId, queueFolder.id),
                    eq(dossiers.assignedGroupId, groupId),
                ),
                columns: { id: true },
            }).then((rows) => rows.map((row) => row.id));

            const makerToComplete = await db.query.dossierAssignments.findFirst({
                where: and(
                    eq(dossierAssignments.assigneeId, editor1.id),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                    inArray(dossierAssignments.dossierId, queueDossierIds),
                ),
            });
            assertExists(makerToComplete);

            const completedDossier = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, makerToComplete.dossierId),
            });
            assertExists(completedDossier);

            await db
                .update(dossierAssignments)
                .set({
                    status: AssignmentStatus.COMPLETED,
                    completedAt: new Date(),
                })
                .where(eq(dossierAssignments.id, makerToComplete.id));

            const continueResult = await GroupService.autoContinueAfterMakerSubmit(
                groupId,
                actorId,
                makerToComplete.dossierId,
                completedDossier.folderId,
            );
            assertExists(continueResult);

            assertEquals(continueResult.totalAssigned, 1);
            assertEquals(continueResult.mode, "continue");
            assertEquals(continueResult.queueSummary.queued, 0);
            assertEquals(continueResult.queueSummary.active, 2);

            const newMaker = await db.query.dossierAssignments.findFirst({
                where: and(
                    eq(dossierAssignments.assigneeId, editor1.id),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                    eq(dossierAssignments.dossierId, queueView.queued[0]!.dossierId),
                ),
            });
            assertExists(newMaker);
        });
    } finally {
        await cleanupTestData(ids);
        await deleteTestProject(projectCode);
    }
});
