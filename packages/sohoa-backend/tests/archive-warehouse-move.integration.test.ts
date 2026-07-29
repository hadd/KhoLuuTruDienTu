import { assertEquals, assertRejects } from "@std/assert";
import { eq, isNull } from "drizzle-orm";
import { AppError } from "@shared/common-lib";
import { db } from "../db/db-conn.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import { userProfiles, userRoles } from "../db/schemas/index.ts";
import { DossierStatus } from "../db/schemas/workflow-constants.ts";
import { hashPassword } from "../libs/helpers/password.ts";
import { AuthRole } from "../modules/auth/auth-helper.ts";
import type { UserWithRoles } from "../libs/plugins/auth-profile.ts";
import { ArchiveWarehouseService } from "../modules/archive/archive-warehouse-service.ts";
import {
    setCopyStorageObjectOverrideForTests,
    setDeleteStorageObjectOverrideForTests,
    setStatStorageObjectOverrideForTests,
    setStorageObjectExistsOverrideForTests,
} from "../modules/archive/archive-warehouse-storage.ts";
import { setUpdateFileRecordOverrideForTests } from "../modules/archive/archive-warehouse-move.ts";
import {
    createArchiveWarehouseMoveFixture,
    createSingleFileArchivedDossier,
    deleteArchiveWarehouseMoveFixture,
} from "./archive-warehouse-test-helper.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";
import { ensureSeededRole } from "./test-role-helper.ts";

const TEST_PREFIX = `test-wh-move/${crypto.randomUUID()}`;

async function createUserWithRole(roleId: string, emailKey: string) {
    const passwordHash = await hashPassword("Test@sohoa2026");
    const [profile] = await db
        .insert(userProfiles)
        .values({
            email: `${TEST_PREFIX}-${emailKey}@test.local`,
            fullName: `Test ${emailKey}`,
            passwordHash,
        })
        .returning();

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

function installWarehouseStorageMocks() {
    const copied = new Map<string, string>();
    const stored = new Set<string>();

    setStorageObjectExistsOverrideForTests(async (key) => stored.has(key));
    setCopyStorageObjectOverrideForTests(async (src, dest) => {
        copied.set(dest, src);
        stored.add(dest);
        return dest;
    });
    setStatStorageObjectOverrideForTests(async () => ({ size: 4096 }));
    setDeleteStorageObjectOverrideForTests(async (key) => {
        stored.delete(key);
        copied.delete(key);
    });

    return { copied, stored };
}

function resetWarehouseStorageMocks() {
    setStorageObjectExistsOverrideForTests(null);
    setCopyStorageObjectOverrideForTests(null);
    setStatStorageObjectOverrideForTests(null);
    setDeleteStorageObjectOverrideForTests(null);
    setUpdateFileRecordOverrideForTests(null);
}

Deno.test({
    name: "Archive Warehouse moveFile integration",
    sanitizeResources: false,
    sanitizeOps: false,
}, async (t) => {
    await ensureSeededRole(AuthRole.ADMIN, "Administrator");
    await ensureSeededRole(AuthRole.EDITOR, "Editor");

    const project = await createTestProject();
    const admin = await createUserWithRole(AuthRole.ADMIN, "admin");
    const editor = await createUserWithRole(AuthRole.EDITOR, "editor");
    const fixture = await createArchiveWarehouseMoveFixture(TEST_PREFIX, project.projectCode);

    try {
        await t.step("forbidden without archive.warehouse.edit", async () => {
            const error = await assertRejects(
                () => ArchiveWarehouseService.moveFile(editor, {
                    dossierId: fixture.sourceDossierId,
                    fileId: fixture.sourceFileToMoveId,
                    targetDossierId: fixture.targetDossierId,
                }),
                AppError,
            ) as AppError;

            assertEquals(error.status, 403);
        });

        await t.step("badRequest when source equals target", async () => {
            const error = await assertRejects(
                () => ArchiveWarehouseService.moveFile(admin, {
                    dossierId: fixture.sourceDossierId,
                    fileId: fixture.sourceFileToMoveId,
                    targetDossierId: fixture.sourceDossierId,
                }),
                AppError,
            ) as AppError;

            assertEquals(error.status, 400);
        });

        await t.step("badRequest when moving last file from source dossier", async () => {
            const single = await createSingleFileArchivedDossier({
                prefix: `${TEST_PREFIX}/single`,
                fondId: fixture.fondId,
                folderPath: `${TEST_PREFIX}/single-dossier`,
                dossierName: "single-dossier",
                projectCode: project.projectCode,
            });

            try {
                const error = await assertRejects(
                    () => ArchiveWarehouseService.moveFile(admin, {
                        dossierId: single.dossier.id,
                        fileId: single.file.id,
                        targetDossierId: fixture.targetDossierId,
                    }),
                    AppError,
                ) as AppError;

                assertEquals(error.status, 400);
            } finally {
                await db.delete(dossierFiles).where(eq(dossierFiles.id, single.file.id));
                await db.delete(dossiers).where(eq(dossiers.id, single.dossier.id));
                await db.delete(folders).where(eq(folders.folderPath, single.folder.folderPath));
            }
        });

        await t.step("successful move updates dossier, marks manual OCR pending, and removes source object", async () => {
            const mocks = installWarehouseStorageMocks();

            try {
                const result = await ArchiveWarehouseService.moveFile(admin, {
                    dossierId: fixture.sourceDossierId,
                    fileId: fixture.sourceFileToMoveId,
                    targetDossierId: fixture.targetDossierId,
                });

                assertEquals(result.sourceDossierId, fixture.sourceDossierId);
                assertEquals(result.targetDossierId, fixture.targetDossierId);
                assertEquals(result.fileId, fixture.sourceFileToMoveId);
                assertEquals(result.sourceStatus, DossierStatus.NEW);
                assertEquals(result.targetStatus, DossierStatus.NEW);
                assertEquals(result.renamed, true);
                assertEquals(result.destFilePath !== fixture.targetCollisionPath, true);

                const movedFile = await db.query.dossierFiles.findFirst({
                    where: eq(dossierFiles.id, fixture.sourceFileToMoveId),
                });
                assertEquals(movedFile?.dossierId, fixture.targetDossierId);
                assertEquals(movedFile?.filePath, result.destFilePath);
                assertEquals(movedFile?.fileName, result.destFileName);
                assertEquals(movedFile?.ocrRunMode, "manual");
                assertEquals(movedFile?.ocrTriggerStatus, "pending");

                const sourceRemainingFile = await db.query.dossierFiles.findFirst({
                    where: eq(dossierFiles.id, fixture.sourceSecondFileId),
                });
                assertEquals(sourceRemainingFile?.ocrRunMode, "manual");
                assertEquals(sourceRemainingFile?.ocrTriggerStatus, "pending");

                const sourceDossier = await db.query.dossiers.findFirst({
                    where: eq(dossiers.id, fixture.sourceDossierId),
                });
                const targetDossier = await db.query.dossiers.findFirst({
                    where: eq(dossiers.id, fixture.targetDossierId),
                });
                assertEquals(sourceDossier?.status, DossierStatus.NEW);
                assertEquals(targetDossier?.status, DossierStatus.NEW);

                assertEquals(mocks.stored.has(fixture.sourceFileToMovePath), false);
                assertEquals(mocks.stored.has(result.destFilePath!), true);

                const untouchedCollision = await db.query.dossierFiles.findFirst({
                    where: eq(dossierFiles.id, fixture.targetCollisionFileId),
                });
                assertEquals(untouchedCollision?.filePath, fixture.targetCollisionPath);
                assertEquals(untouchedCollision?.ocrRunMode, "manual");
                assertEquals(untouchedCollision?.ocrTriggerStatus, "pending");
            } finally {
                resetWarehouseStorageMocks();
            }
        });

        await t.step("compensates dest object when DB update fails after copy", async () => {
            const collisionFixture = await createArchiveWarehouseMoveFixture(
                `${TEST_PREFIX}/rollback`,
                project.projectCode,
            );
            const mocks = installWarehouseStorageMocks();

            setUpdateFileRecordOverrideForTests(async () => {
                throw new Error("forced db failure");
            });

            try {
                await assertRejects(
                    () => ArchiveWarehouseService.moveFile(admin, {
                        dossierId: collisionFixture.sourceDossierId,
                        fileId: collisionFixture.sourceFileToMoveId,
                        targetDossierId: collisionFixture.targetDossierId,
                    }),
                    Error,
                    "forced db failure",
                );

                const unchanged = await db.query.dossierFiles.findFirst({
                    where: eq(dossierFiles.id, collisionFixture.sourceFileToMoveId),
                });
                assertEquals(unchanged?.dossierId, collisionFixture.sourceDossierId);
                assertEquals(unchanged?.filePath, collisionFixture.sourceFileToMovePath);
                assertEquals(mocks.stored.has(collisionFixture.sourceFileToMovePath), false);
                assertEquals(
                    [...mocks.stored].some((key) =>
                        key.startsWith(collisionFixture.targetFolderPath)
                    ),
                    false,
                );
            } finally {
                resetWarehouseStorageMocks();
                await deleteArchiveWarehouseMoveFixture(collisionFixture);
            }
        });
    } finally {
        resetWarehouseStorageMocks();
        await deleteArchiveWarehouseMoveFixture(fixture);
        await deleteTestProject(project.projectCode);
    }
});
