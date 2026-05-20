import { assertEquals, assertExists } from "@std/assert";
import { eq } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import {
    DossierService,
    setStorageStatOverrideForTests,
} from "../modules/dossier/dossier-service.ts";

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

Deno.test("Dossier Integration Tests", async (t) => {
    const fileKey = `${TEST_PREFIX}/ho-so-123/scan.pdf`;
    const folderPath = `${TEST_PREFIX}/ho-so-123`;

    setStorageStatOverrideForTests(async () => ({ fileSizeKb: 2 }));

    try {
        await t.step("checkFilePathExists returns false when not registered", async () => {
            const result = await DossierService.checkFilePathExists(fileKey);
            assertEquals(result.exists, false);
        });

        await t.step("createDocumentFromStorage creates folder, dossier, and file", async () => {
            const first = await DossierService.createDocumentFromStorage({ key: fileKey });

            assertEquals(first.created, true);
            assertExists(first.dossier.id);
            assertExists(first.file.id);
            assertEquals(first.file.filePath, fileKey);
            assertEquals(first.dossier.name, "ho-so-123");
            assertEquals(first.dossier.folderPath, folderPath);
        });

        await t.step("checkFilePathExists returns true after registration", async () => {
            const result = await DossierService.checkFilePathExists(fileKey);
            assertEquals(result.exists, true);
            if (result.exists) {
                assertExists(result.fileId);
            }
        });

        await t.step("createDocumentFromStorage is idempotent for same key", async () => {
            const second = await DossierService.createDocumentFromStorage({ key: fileKey });

            assertEquals(second.created, false);
            assertEquals(second.file.filePath, fileKey);

            const allFiles = await db.query.dossierFiles.findMany({
                where: eq(dossierFiles.filePath, fileKey),
            });
            assertEquals(allFiles.length, 1);
        });
    } finally {
        setStorageStatOverrideForTests(null);
        await cleanupTestData(fileKey, folderPath);
    }
});
