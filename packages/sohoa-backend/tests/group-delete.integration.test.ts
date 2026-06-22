import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { AppError } from "@shared/common-lib";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierAssignments } from "../db/schemas/dossier-assignment.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { groupMembers } from "../db/schemas/group_members.ts";
import { groups } from "../db/schemas/groups.ts";
import { folders } from "../db/schemas/folder.ts";
import { userProfiles, userRoles } from "../db/schemas/index.ts";
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
import { ensureSeededRole } from "./test-role-helper.ts";

const TEST_PREFIX = `test-group-delete/${crypto.randomUUID()}`;
const TEST_PASSWORD = "Test@sohoa2026";

type CreatedIds = {
    groupIds: string[];
    userIds: string[];
    folderIds: string[];
    dossierIds: string[];
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
    name: "Group delete guards integration",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn(t) {
    const project = await createTestProject();
    const projectCode = project.projectCode;
    const ids: CreatedIds = {
        groupIds: [],
        userIds: [],
        folderIds: [],
        dossierIds: [],
    };

    await ensureSeededRole(AuthRole.EDITOR, "Editor");
    await ensureSeededRole(AuthRole.QC, "QC");

    const editor = await createTestUser({
        email: `${TEST_PREFIX}-editor@test.local`,
        fullName: "Delete Test Editor",
        roleId: AuthRole.EDITOR,
    });
    const qc = await createTestUser({
        email: `${TEST_PREFIX}-qc@test.local`,
        fullName: "Delete Test QC",
        roleId: AuthRole.QC,
    });
    ids.userIds.push(editor.id, qc.id);

    const { record: group } = await GroupService.create({
        name: `Delete Group ${TEST_PREFIX}`,
        roundNumber: 1,
        editorIds: [editor.id],
        qcLevels: [{ userIds: [qc.id] }],
        leaderId: qc.id,
    });
    ids.groupIds.push(group.id);

    const folderPath = `${TEST_PREFIX}/delete`;
    const folder = await FolderService.create({
        folderPath,
        folderName: "delete",
        projectCode,
    });
    ids.folderIds.push(folder.id);

    async function createAssignedDossier(
        name: string,
        status: typeof DossierStatus[keyof typeof DossierStatus],
    ) {
        const [dossier] = await db.insert(dossiers).values({
            folderId: folder.id,
            folderPath,
            name,
            entityType: EntityType.DOCUMENT,
            status,
            assignedGroupId: group.id,
        }).returning();
        ids.dossierIds.push(dossier.id);
        return dossier;
    }

    try {
        await t.step("blocks delete when dossier is ENTRY_PROCESSING", async () => {
            const dossier = await createAssignedDossier(
                "entry-processing",
                DossierStatus.ENTRY_PROCESSING,
            );

            const error = await assertRejects(
                () => GroupService.delete(group.id, {
                    actorUserId: qc.id,
                    isAdmin: true,
                }),
                AppError,
            ) as AppError;

            assertEquals(error.status, 409);
            assertEquals(
                (error.details as { code: string }).code,
                "GROUP_HAS_BLOCKING_DOSSIERS",
            );

            const unchanged = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, dossier.id),
            });
            assertEquals(unchanged?.assignedGroupId, group.id);

            const activeGroup = await db.query.groups.findFirst({
                where: eq(groups.id, group.id),
            });
            assertEquals(activeGroup?.deletedAt, null);
        });

        await t.step("blocks delete when dossier is WAITING_CHECKER_1", async () => {
            await db
                .update(dossiers)
                .set({ status: DossierStatus.READY_FOR_ENTRY })
                .where(eq(dossiers.id, ids.dossierIds[0]!));

            const waitingDossier = await createAssignedDossier(
                "waiting-checker",
                DossierStatus.WAITING_CHECKER_1,
            );

            const error = await assertRejects(
                () => GroupService.delete(group.id, {
                    actorUserId: qc.id,
                    isAdmin: true,
                }),
                AppError,
            ) as AppError;

            assertEquals(error.status, 409);
            assertExists(waitingDossier.id);
        });

        await t.step("deletes group and cleans up READY_FOR_ENTRY dossiers", async () => {
            await db.delete(dossiers).where(eq(dossiers.id, ids.dossierIds[1]!));
            ids.dossierIds.splice(1, 1);

            const readyDossier = await createAssignedDossier(
                "ready-for-entry",
                DossierStatus.READY_FOR_ENTRY,
            );

            await db.insert(dossierAssignments).values({
                dossierId: readyDossier.id,
                role: WorkerRole.MAKER,
                assigneeId: editor.id,
                status: AssignmentStatus.IN_PROGRESS,
            });
            await db.insert(dossierAssignments).values({
                dossierId: readyDossier.id,
                role: WorkerRole.CHECKER_1,
                assigneeId: qc.id,
                status: AssignmentStatus.IN_PROGRESS,
            });

            const result = await GroupService.delete(group.id, {
                actorUserId: qc.id,
                isAdmin: true,
            });
            assertEquals(result.status, "deleted");

            const updatedDossier = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, readyDossier.id),
            });
            assertEquals(updatedDossier?.assignedGroupId, null);

            const assignments = await db.query.dossierAssignments.findMany({
                where: eq(dossierAssignments.dossierId, readyDossier.id),
            });
            assertEquals(
                assignments.every((row) => row.status === AssignmentStatus.TRANSFERRED),
                true,
            );

            const deletedGroup = await db.query.groups.findFirst({
                where: eq(groups.id, group.id),
            });
            assertExists(deletedGroup?.deletedAt);
        });

        await t.step("deletes group when only APPROVED dossiers remain assigned", async () => {
            const { record: approvedGroup } = await GroupService.create({
                name: `Approved Group ${TEST_PREFIX}`,
                roundNumber: 1,
                editorIds: [editor.id],
                qcLevels: [{ userIds: [qc.id] }],
                leaderId: qc.id,
            });
            ids.groupIds.push(approvedGroup.id);

            const [approvedDossier] = await db.insert(dossiers).values({
                folderId: folder.id,
                folderPath,
                name: "approved-only",
                entityType: EntityType.DOCUMENT,
                status: DossierStatus.APPROVED,
                assignedGroupId: approvedGroup.id,
            }).returning();
            ids.dossierIds.push(approvedDossier.id);

            const result = await GroupService.delete(approvedGroup.id, {
                actorUserId: qc.id,
                isAdmin: true,
            });
            assertEquals(result.status, "deleted");

            const unchanged = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, approvedDossier.id),
            });
            assertEquals(unchanged?.assignedGroupId, approvedGroup.id);
            assertEquals(unchanged?.status, DossierStatus.APPROVED);
        });
    } finally {
        await cleanupTestData(ids);
        await deleteTestProject(projectCode);
    }
    },
});
