import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import { setPurgeDossierFromMinIOOverrideForTests } from "../modules/dossier/dossier-delete-utils.ts";
import {
    DossierService,
    setStorageStatOverrideForTests,
} from "../modules/dossier/dossier-service.ts";
import { activeDossierWhere, activeFolderWhere } from "../modules/dossier/active-query-filters.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";

const TEST_PREFIX = `test-dossier/${crypto.randomUUID()}`;

async function cleanupTestData(filePath: string, folderPath: string) {
    await db.delete(dossierFiles).where(eq(dossierFiles.filePath, filePath));
    await db.delete(dossiers).where(eq(dossiers.folderPath, folderPath));
    const segments = folderPath.split("/").filter(Boolean);
    for (let i = segments.length; i > 0; i--) {
        const segmentPath = segments.slice(0, i).join("/");
        await db.delete(folders).where(eq(folders.folderPath, segmentPath));
    }
}

Deno.test({
    name: "Dossier Integration Tests",
    sanitizeResources: false,
    sanitizeOps: false,
}, async (t) => {
    const project = await createTestProject();
    const projectCode = project.projectCode;
    const fileKey = `${TEST_PREFIX}/ho-so-123/scan.pdf`;
    const folderPath = `${TEST_PREFIX}/ho-so-123`;

    setStorageStatOverrideForTests(async () => ({ fileSizeKb: 2 }));

    try {
        await t.step("createDocumentFromStorage rejects missing project", async () => {
            await assertRejects(() => DossierService.createDocumentFromStorage({
                key: fileKey,
                projectCode: "UNKNOWN-PROJECT",
            }));
        });

        await t.step("checkFilePathExists returns false when not registered", async () => {
            const result = await DossierService.checkFilePathExists(fileKey);
            assertEquals(result.exists, false);
        });

        await t.step("createDocumentFromStorage creates folder, dossier, and file", async () => {
            const first = await DossierService.createDocumentFromStorage({
                key: fileKey,
                projectCode,
            });

            assertEquals(first.created, true);
            assertExists(first.dossier.id);
            assertExists(first.file.id);
            assertEquals(first.file.filePath, fileKey);
            assertEquals(first.dossier.name, "ho-so-123");
            assertEquals(first.dossier.folderPath, folderPath);
            assertEquals(first.dossier.projectCode, projectCode);
            assertEquals(first.dossier.requiredQcCount, 0);

            const folder = await db.query.folders.findFirst({
                where: eq(folders.folderPath, folderPath),
            });
            assertEquals(folder?.projectCode, projectCode);
        });

        await t.step("checkFilePathExists returns true after registration", async () => {
            const result = await DossierService.checkFilePathExists(fileKey);
            assertEquals(result.exists, true);
            if (result.exists) {
                assertExists(result.fileId);
            }
        });

        await t.step("createDocumentFromStorage is idempotent for same key", async () => {
            const second = await DossierService.createDocumentFromStorage({
                key: fileKey,
                projectCode,
            });

            assertEquals(second.created, false);
            assertEquals(second.file.filePath, fileKey);

            const allFiles = await db.query.dossierFiles.findMany({
                where: eq(dossierFiles.filePath, fileKey),
            });
            assertEquals(allFiles.length, 1);
        });

        let dossierId = "";

        await t.step("soft delete sets deletedAt and hides from active lookup", async () => {
            const row = await db.query.dossiers.findFirst({
                where: and(eq(dossiers.folderPath, folderPath), isNull(dossiers.deletedAt)),
            });
            assertExists(row);
            dossierId = row.id;

            const result = await DossierService.delete(dossierId);
            assertEquals(result.mode, "soft");

            const softDeleted = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, dossierId),
            });
            assertExists(softDeleted?.deletedAt);

            const active = await db.query.dossiers.findFirst({
                where: and(eq(dossiers.id, dossierId), isNull(dossiers.deletedAt)),
            });
            assertEquals(active, undefined);

            const softDeletedFolder = await db.query.folders.findFirst({
                where: eq(folders.folderPath, folderPath),
            });
            assertExists(softDeletedFolder?.deletedAt);
        });

        await t.step("createDocumentFromStorage after soft delete creates a new active dossier", async () => {
            const recreated = await DossierService.createDocumentFromStorage({
                key: fileKey,
                projectCode,
            });
            assertExists(recreated.dossier.id);
            assertEquals(recreated.dossier.id !== dossierId, true);

            const activeRows = await db.query.dossiers.findMany({
                where: and(eq(dossiers.folderPath, folderPath), isNull(dossiers.deletedAt)),
            });
            assertEquals(activeRows.length, 1);
            assertEquals(activeRows[0].id, recreated.dossier.id);
            dossierId = recreated.dossier.id;
        });

        setPurgeDossierFromMinIOOverrideForTests(async () => 1);

        await t.step("permanent delete removes dossier and orphan folders", async () => {
            const leafFolder = await db.query.folders.findFirst({
                where: activeFolderWhere(eq(folders.folderPath, folderPath)),
            });
            assertExists(leafFolder);

            const result = await DossierService.delete(dossierId, { permanent: true });
            assertEquals(result.mode, "permanent");
            if (result.mode === "permanent") {
                assertEquals(result.deletedObjectCount, 1);
                assertEquals(result.deletedFolderIds.includes(leafFolder.id), true);
            }

            const gone = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, dossierId),
            });
            assertEquals(gone, undefined);

            const folderGone = await db.query.folders.findFirst({
                where: activeFolderWhere(eq(folders.folderPath, folderPath)),
            });
            assertEquals(folderGone, undefined);
        });
    } finally {
        setStorageStatOverrideForTests(null);
        setPurgeDossierFromMinIOOverrideForTests(null);
        await cleanupTestData(fileKey, folderPath);
        await deleteTestProject(projectCode);
    }
});
