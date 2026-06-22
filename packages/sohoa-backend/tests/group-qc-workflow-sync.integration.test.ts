import { assertEquals, assertExists } from "@std/assert";
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

const TEST_PREFIX = `test-qc-sync/${crypto.randomUUID()}`;
const TEST_PASSWORD = "Test@sohoa2026";

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

Deno.test("Group QC workflow sync integration", async (t) => {
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

    const editor = await createTestUser({
        email: `${TEST_PREFIX}-editor@test.local`,
        fullName: "Sync Editor",
        roleId: AuthRole.EDITOR,
    });
    const qcA = await createTestUser({
        email: `${TEST_PREFIX}-qcA@test.local`,
        fullName: "QC A",
        roleId: AuthRole.QC,
    });
    const qcB = await createTestUser({
        email: `${TEST_PREFIX}-qcB@test.local`,
        fullName: "QC B",
        roleId: AuthRole.QC,
    });
    const qcC = await createTestUser({
        email: `${TEST_PREFIX}-qcC@test.local`,
        fullName: "QC C",
        roleId: AuthRole.QC,
    });
    ids.userIds.push(editor.id, qcA.id, qcB.id, qcC.id);

    const actorId = editor.id;

    try {
        let groupId = "";

        await t.step("create group with single peer per level", async () => {
            const { record } = await GroupService.create({
                name: `Sync Group ${TEST_PREFIX}`,
                roundNumber: 2,
                editorIds: [editor.id],
                qcLevels: [{ userIds: [qcA.id] }, { userIds: [qcB.id] }],
            });
            groupId = record.id;
            ids.groupIds.push(groupId);
            assertEquals(record.qcLevels.length, 2);
        });

        const leafPath = `${TEST_PREFIX}/leaf`;
        const leafFolder = await FolderService.create({
            folderPath: leafPath,
            folderName: "leaf",
            projectCode,
        });
        ids.folderIds.push(leafFolder.id);

        const dossierNames = ["sync-1", "sync-2", "sync-3"];
        for (const name of dossierNames) {
            const [row] = await db.insert(dossiers).values({
                folderId: leafFolder.id,
                folderPath: leafPath,
                name,
                entityType: EntityType.DOCUMENT,
            }).returning();
            ids.dossierIds.push(row.id);
            const [file] = await db.insert(dossierFiles).values({
                dossierId: row.id,
                fileName: "scan.pdf",
                filePath: `${leafPath}/${name}/scan.pdf`,
                fileSizeKb: 10,
            }).returning();
            ids.fileIds.push(file.id);
        }

        await t.step("assign dossiers and complete maker for QC queue", async () => {
            const result = await GroupService.assignByFolder(
                groupId,
                { folderIds: [leafFolder.id], dossiersPerEditor: 5 },
                actorId,
            );
            assertEquals(result.totalAssigned, 3);

            for (const dossierId of ids.dossierIds) {
                await db
                    .update(dossiers)
                    .set({
                        status: DossierStatus.WAITING_CHECKER_2,
                        currentQcStep: 1,
                    })
                    .where(eq(dossiers.id, dossierId));

                await db
                    .update(dossierAssignments)
                    .set({
                        status: AssignmentStatus.COMPLETED,
                        completedAt: new Date(),
                    })
                    .where(and(
                        eq(dossierAssignments.dossierId, dossierId),
                        eq(dossierAssignments.role, WorkerRole.CHECKER_1),
                    ));
            }
        });

        await t.step("adding peers at level 2 redistributes pending checker assignments", async () => {
            const { syncResult } = await GroupService.update(
                groupId,
                {
                    qcLevels: [{ userIds: [qcA.id] }, { userIds: [qcB.id, qcC.id] }],
                },
                actorId,
            );

            assertExists(syncResult);
            assertEquals(syncResult!.assignmentsTransferred >= 1, true);

            const checker2 = await db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, ids.dossierIds),
                    eq(dossierAssignments.role, WorkerRole.CHECKER_2),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ),
            });

            assertEquals(checker2.length, 3);
            const assigneeIds = new Set(checker2.map((row) => row.assigneeId));
            assertEquals(assigneeIds.has(qcB.id), true);
            assertEquals(assigneeIds.has(qcC.id), true);
        });

        await t.step("increasing roundNumber skips APPROVED dossiers but applies to others", async () => {
            const [approvedDossier, pendingDossier] = ids.dossierIds;
            await db
                .update(dossiers)
                .set({
                    status: DossierStatus.APPROVED,
                    currentQcStep: 2,
                    requiredQcCount: 2,
                })
                .where(eq(dossiers.id, approvedDossier!));

            const qcD = await createTestUser({
                email: `${TEST_PREFIX}-qcD@test.local`,
                fullName: "QC D",
                roleId: AuthRole.QC,
            });
            ids.userIds.push(qcD.id);

            const { syncResult } = await GroupService.update(
                groupId,
                {
                    roundNumber: 3,
                    qcLevels: [
                        { userIds: [qcA.id] },
                        { userIds: [qcB.id, qcC.id] },
                        { userIds: [qcD.id] },
                    ],
                },
                actorId,
            );

            assertExists(syncResult);
            assertEquals(syncResult!.levelsActivated, 0);

            const approved = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, approvedDossier!),
            });
            assertEquals(approved?.status, DossierStatus.APPROVED);
            assertEquals(approved?.requiredQcCount, 2);

            const approvedChecker3 = await db.query.dossierAssignments.findFirst({
                where: and(
                    eq(dossierAssignments.dossierId, approvedDossier!),
                    eq(dossierAssignments.role, WorkerRole.CHECKER_3),
                ),
            });
            assertEquals(approvedChecker3, undefined);

            const pending = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, pendingDossier!),
            });
            assertEquals(pending?.requiredQcCount, 3);

            const pendingChecker3 = await db.query.dossierAssignments.findFirst({
                where: and(
                    eq(dossierAssignments.dossierId, pendingDossier!),
                    eq(dossierAssignments.role, WorkerRole.CHECKER_3),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ),
            });
            assertExists(pendingChecker3);
            assertEquals(pendingChecker3.assigneeId, qcD.id);
        });
    } finally {
        await cleanupTestData(ids);
        await deleteTestProject(projectCode);
    }
});
