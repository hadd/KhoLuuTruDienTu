import { assertEquals, assertExists } from "@std/assert";
import { eq } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import { getRawStoragePrefix } from "../modules/dossier/dossier-path-utils.ts";
import {
    DossierService,
    setStorageStatOverrideForTests,
} from "../modules/dossier/dossier-service.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";

const TEST_RUN_ID = crypto.randomUUID();

async function cleanupTestData(fileKeys: string[], folderPaths: string[]) {
    for (const filePath of fileKeys) {
        await db.delete(dossierFiles).where(eq(dossierFiles.filePath, filePath));
    }
    for (const folderPath of folderPaths) {
        await db.delete(dossiers).where(eq(dossiers.folderPath, folderPath));
        const segments = folderPath.split("/").filter(Boolean);
        for (let i = segments.length; i > 0; i--) {
            const segmentPath = segments.slice(0, i).join("/");
            if (segmentPath === getRawStoragePrefix()) {
                continue;
            }
            await db.delete(folders).where(eq(folders.folderPath, segmentPath));
        }
    }
}

Deno.test({
    name: "Dossier raw root integration",
    sanitizeResources: false,
    sanitizeOps: false,
}, async (t) => {
    const projectA = await createTestProject();
    const projectB = await createTestProject();
    const rawPrefix = getRawStoragePrefix();
    const fileKeyA = `${rawPrefix}/test-raw-root-a/${TEST_RUN_ID}/ho-so/scan.pdf`;
    const fileKeyB = `${rawPrefix}/test-raw-root-b/${TEST_RUN_ID}/ho-so/scan.pdf`;
    const folderPathA = `${rawPrefix}/test-raw-root-a/${TEST_RUN_ID}/ho-so`;
    const folderPathB = `${rawPrefix}/test-raw-root-b/${TEST_RUN_ID}/ho-so`;

    setStorageStatOverrideForTests(async () => ({ fileSizeKb: 2 }));

    try {
        await t.step("raw root stays unscoped when registering under project A", async () => {
            const result = await DossierService.createDocumentFromStorage({
                key: fileKeyA,
                projectCode: projectA.projectCode,
            });

            assertEquals(result.created, true);
            assertEquals(result.dossier.projectCode, projectA.projectCode);

            const rawRoot = await db.query.folders.findFirst({
                where: eq(folders.folderPath, rawPrefix),
            });
            assertExists(rawRoot);
            assertEquals(rawRoot.projectCode, null);

            const leafFolder = await db.query.folders.findFirst({
                where: eq(folders.folderPath, folderPathA),
            });
            assertExists(leafFolder);
            assertEquals(leafFolder.projectCode, projectA.projectCode);
        });

        await t.step("registering under project B does not conflict on shared raw root", async () => {
            const result = await DossierService.createDocumentFromStorage({
                key: fileKeyB,
                projectCode: projectB.projectCode,
            });

            assertEquals(result.created, true);
            assertEquals(result.dossier.projectCode, projectB.projectCode);

            const rawRoot = await db.query.folders.findFirst({
                where: eq(folders.folderPath, rawPrefix),
            });
            assertExists(rawRoot);
            assertEquals(rawRoot.projectCode, null);
        });

        await t.step("heals raw root that was wrongly scoped to a project", async () => {
            const rawRoot = await db.query.folders.findFirst({
                where: eq(folders.folderPath, rawPrefix),
            });
            assertExists(rawRoot);

            await db
                .update(folders)
                .set({ projectCode: projectA.projectCode, updatedAt: new Date() })
                .where(eq(folders.id, rawRoot.id));

            await DossierService.createDocumentFromStorage({
                key: fileKeyA,
                projectCode: projectA.projectCode,
            });

            const healed = await db.query.folders.findFirst({
                where: eq(folders.folderPath, rawPrefix),
            });
            assertExists(healed);
            assertEquals(healed.projectCode, null);
        });
    } finally {
        setStorageStatOverrideForTests(null);
        await cleanupTestData([fileKeyA, fileKeyB], [folderPathA, folderPathB]);
        await deleteTestProject(projectA.projectCode);
        await deleteTestProject(projectB.projectCode);
    }
});
