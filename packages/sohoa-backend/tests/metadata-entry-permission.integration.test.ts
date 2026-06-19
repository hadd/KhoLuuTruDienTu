import { assertEquals } from "@std/assert";
import { eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierAssignments } from "../db/schemas/dossier-assignment.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import { userProfiles, userRoles, roles } from "../db/schemas/index.ts";
import {
    AssignmentStatus,
    DossierStatus,
    EntityType,
    WorkerRole,
} from "../db/schemas/workflow-constants.ts";
import { AuthRole, authHelper } from "../modules/auth/auth-helper.ts";
import { Permission } from "../modules/auth/permission-catalog.ts";
import type { UserWithRoles } from "../libs/plugins/auth-profile.ts";
import { hashPassword } from "../libs/helpers/password.ts";
import { FolderService } from "../modules/folder/folder-service.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";
import { ensureSeededRole } from "./test-role-helper.ts";

const TEST_PREFIX = `test-meta-perm/${crypto.randomUUID()}`;

async function createUserWithRole(roleId: string) {
    const passwordHash = await hashPassword("Test@sohoa2026");
    const [profile] = await db.insert(userProfiles).values({
        email: `${TEST_PREFIX}-${roleId}@test.local`,
        fullName: `Test ${roleId}`,
        passwordHash,
    }).returning();

    await db.insert(userRoles).values({ userId: profile.id, roleId });

    const fullProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, profile.id),
        with: {
            userRoles: {
                where: isNull(userRoles.expiredAt),
                with: { role: true },
            },
        },
    });

    return fullProfile as UserWithRoles;
}

Deno.test({
    name: "metadata entry permission: checkWorkflowAccess for maker metadata submit",
    sanitizeResources: false,
    sanitizeOps: false,
}, async (t) => {
    await ensureSeededRole(AuthRole.EDITOR, "Editor");

    const project = await createTestProject();
    const folderPath = `${TEST_PREFIX}/leaf`;
    const folderIds: string[] = [];
    const dossierIds: string[] = [];
    const userIds: string[] = [];

    try {
        const folder = await FolderService.create({
            folderPath,
            folderName: "leaf",
            projectCode: project.projectCode,
        });
        folderIds.push(folder.id);

        const [dossier] = await db.insert(dossiers).values({
            folderId: folder.id,
            folderPath,
            name: "ho-so-test",
            entityType: EntityType.DOCUMENT,
            status: DossierStatus.ENTRY_PROCESSING,
        }).returning();
        dossierIds.push(dossier.id);

        const editor = await createUserWithRole(AuthRole.EDITOR);
        userIds.push(editor.id);

        await t.step("editor with data-entry.maker and MAKER assignment passes", async () => {
            await db.insert(dossierAssignments).values({
                dossierId: dossier.id,
                assigneeId: editor.id,
                role: WorkerRole.MAKER,
                status: AssignmentStatus.IN_PROGRESS,
            });

            await authHelper.checkWorkflowAccess(editor, {
                permission: Permission.DATA_ENTRY_MAKER,
                workerRoles: [WorkerRole.MAKER],
                dossierId: dossier.id,
            });
        });

        await t.step("editor with data-entry.maker passes auth even without assignment", async () => {
            await db.delete(dossierAssignments).where(
                eq(dossierAssignments.dossierId, dossier.id),
            );

            await authHelper.checkWorkflowAccess(editor, {
                permission: Permission.DATA_ENTRY_MAKER,
                workerRoles: [WorkerRole.MAKER],
                dossierId: dossier.id,
            });
        });

        await t.step("user without data-entry.maker and without assignment is forbidden", async () => {
            await ensureSeededRole("reader-only", "Reader Only");
            await db.update(roles)
                .set({
                    rules: JSON.stringify({
                        permissions: ["dossiers.read"],
                        restrictions: [],
                    }),
                })
                .where(eq(roles.id, "reader-only"));

            const reader = await createUserWithRole("reader-only");
            userIds.push(reader.id);

            try {
                await authHelper.checkWorkflowAccess(reader, {
                    permission: Permission.DATA_ENTRY_MAKER,
                    workerRoles: [WorkerRole.MAKER],
                    dossierId: dossier.id,
                });
                throw new Error("expected forbidden");
            } catch (error) {
                assertEquals(error instanceof Error, true);
                assertEquals(
                    (error as Error).message,
                    `Permission required: ${Permission.DATA_ENTRY_MAKER}`,
                );
            }
        });
    } finally {
        if (dossierIds.length > 0) {
            await db.delete(dossierAssignments).where(
                inArray(dossierAssignments.dossierId, dossierIds),
            );
            await db.delete(dossiers).where(inArray(dossiers.id, dossierIds));
        }
        if (userIds.length > 0) {
            await db.delete(userRoles).where(inArray(userRoles.userId, userIds));
            await db.delete(userProfiles).where(inArray(userProfiles.id, userIds));
        }
        if (folderIds.length > 0) {
            await db.delete(folders).where(inArray(folders.id, folderIds));
        }
        await deleteTestProject(project.projectCode);
    }
});
