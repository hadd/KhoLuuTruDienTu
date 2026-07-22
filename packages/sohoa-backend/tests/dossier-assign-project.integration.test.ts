import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { eq, like } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import {
    DossierStatus,
    EntityType,
} from "../db/schemas/workflow-constants.ts";
import { activeFolderWhere } from "../modules/dossier/active-query-filters.ts";
import {
    DossierService,
    setStorageStatOverrideForTests,
} from "../modules/dossier/dossier-service.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";

/** Mỗi case một root riêng để tránh conflict projectCode trên folder cha. */
function uniqueRoot(label: string) {
    return `tap-${label}-${crypto.randomUUID()}`;
}

async function cleanupByPrefix(prefix: string) {
    await db.delete(dossierFiles).where(like(dossierFiles.filePath, `${prefix}%`));
    await db.delete(dossiers).where(like(dossiers.folderPath, `${prefix}%`));

    const folderRows = await db.query.folders.findMany({
        where: like(folders.folderPath, `${prefix}%`),
    });
    folderRows.sort((a, b) => b.folderPath.length - a.folderPath.length);
    for (const folder of folderRows) {
        await db.delete(folders).where(eq(folders.id, folder.id));
    }
}

Deno.test({
    name: "Dossier assign project integration",
    sanitizeResources: false,
    sanitizeOps: false,
}, async (t) => {
    const projectA = await createTestProject();
    const projectB = await createTestProject();
    const projectCodeA = projectA.projectCode;
    const projectCodeB = projectB.projectCode;
    const prefixes: string[] = [];

    setStorageStatOverrideForTests(async () => ({ fileSizeKb: 2 }));

    try {
        await t.step("assigns project when dossier projectCode is null", async () => {
            const root = uniqueRoot("null");
            prefixes.push(root);
            const folderPath = `${root}/ho-so`;
            const fileKey = `${folderPath}/scan.pdf`;

            const created = await DossierService.createDocumentFromStorage({
                key: fileKey,
                projectCode: null,
            });
            assertEquals(created.dossier.projectCode, null);

            const updated = await DossierService.update(created.dossier.id, {
                projectCode: projectCodeA,
            });
            assertEquals(updated.projectCode, projectCodeA);

            const leafFolder = await db.query.folders.findFirst({
                where: activeFolderWhere(eq(folders.folderPath, folderPath)),
            });
            assertExists(leafFolder);
            assertEquals(leafFolder.projectCode, projectCodeA);
        });

        await t.step("reassigns project when status is NEW", async () => {
            const root = uniqueRoot("reassign");
            prefixes.push(root);
            const folderPath = `${root}/ho-so`;
            const fileKey = `${folderPath}/scan.pdf`;

            const created = await DossierService.createDocumentFromStorage({
                key: fileKey,
                projectCode: projectCodeA,
            });
            assertEquals(created.dossier.status, DossierStatus.NEW);
            assertEquals(created.dossier.projectCode, projectCodeA);

            const updated = await DossierService.update(created.dossier.id, {
                projectCode: projectCodeB,
            });
            assertEquals(updated.projectCode, projectCodeB);

            const leafFolder = await db.query.folders.findFirst({
                where: activeFolderWhere(eq(folders.folderPath, folderPath)),
            });
            assertExists(leafFolder);
            assertEquals(leafFolder.projectCode, projectCodeB);
        });

        await t.step("reassigns project when status is READY_FOR_ENTRY", async () => {
            const root = uniqueRoot("ready");
            prefixes.push(root);
            const folderPath = `${root}/ho-so`;
            const fileKey = `${folderPath}/scan.pdf`;

            const created = await DossierService.createDocumentFromStorage({
                key: fileKey,
                projectCode: projectCodeA,
            });

            await db
                .update(dossiers)
                .set({ status: DossierStatus.READY_FOR_ENTRY })
                .where(eq(dossiers.id, created.dossier.id));

            const updated = await DossierService.update(created.dossier.id, {
                projectCode: projectCodeB,
            });
            assertEquals(updated.projectCode, projectCodeB);

            const leafFolder = await db.query.folders.findFirst({
                where: activeFolderWhere(eq(folders.folderPath, folderPath)),
            });
            assertExists(leafFolder);
            assertEquals(leafFolder.projectCode, projectCodeB);
        });

        await t.step("rejects reassign when status is not eligible", async () => {
            const root = uniqueRoot("blocked");
            prefixes.push(root);
            const folderPath = `${root}/ho-so`;
            const fileKey = `${folderPath}/scan.pdf`;

            const created = await DossierService.createDocumentFromStorage({
                key: fileKey,
                projectCode: projectCodeA,
            });

            await db
                .update(dossiers)
                .set({ status: DossierStatus.ENTRY_PROCESSING })
                .where(eq(dossiers.id, created.dossier.id));

            const error = await assertRejects(() =>
                DossierService.update(created.dossier.id, {
                    projectCode: projectCodeB,
                })
            );
            assertEquals((error as { status: number }).status, 400);
        });

        await t.step("rejects unknown projectCode", async () => {
            const root = uniqueRoot("unknown");
            prefixes.push(root);
            const folderPath = `${root}/ho-so`;
            const fileKey = `${folderPath}/scan.pdf`;

            const created = await DossierService.createDocumentFromStorage({
                key: fileKey,
                projectCode: null,
            });

            await assertRejects(() =>
                DossierService.update(created.dossier.id, {
                    projectCode: "UNKNOWN-PROJECT-CODE",
                })
            );
        });

        await t.step(
            "rejects when sibling has different project and is not eligible",
            async () => {
                const root = uniqueRoot("sibling");
                prefixes.push(root);
                const siblingFolderPath = `${root}/leaf`;
                const [leaf] = await db
                    .insert(folders)
                    .values({
                        parentId: null,
                        folderPath: siblingFolderPath,
                        folderName: "leaf",
                        projectCode: projectCodeA,
                    })
                    .returning();
                assertExists(leaf);

                const [target] = await db
                    .insert(dossiers)
                    .values({
                        folderId: leaf.id,
                        folderPath: siblingFolderPath,
                        name: "target-hs",
                        entityType: EntityType.DOCUMENT,
                        status: DossierStatus.NEW,
                        projectCode: projectCodeA,
                        requiredQcCount: 0,
                    })
                    .returning();
                assertExists(target);

                const [sibling] = await db
                    .insert(dossiers)
                    .values({
                        folderId: leaf.id,
                        folderPath: siblingFolderPath,
                        name: "sibling-hs",
                        entityType: EntityType.DOCUMENT,
                        status: DossierStatus.ENTRY_PROCESSING,
                        projectCode: projectCodeA,
                        requiredQcCount: 0,
                    })
                    .returning();
                assertExists(sibling);

                const error = await assertRejects(() =>
                    DossierService.update(target.id, {
                        projectCode: projectCodeB,
                    })
                );
                assertEquals((error as { status: number }).status, 409);
            },
        );

        await t.step("cascades eligible siblings to the new project", async () => {
            const root = uniqueRoot("cascade");
            prefixes.push(root);
            const cascadePath = `${root}/leaf`;
            const [leaf] = await db
                .insert(folders)
                .values({
                    parentId: null,
                    folderPath: cascadePath,
                    folderName: "leaf",
                    projectCode: projectCodeA,
                })
                .returning();
            assertExists(leaf);

            const [target] = await db
                .insert(dossiers)
                .values({
                    folderId: leaf.id,
                    folderPath: cascadePath,
                    name: "cascade-target",
                    entityType: EntityType.DOCUMENT,
                    status: DossierStatus.NEW,
                    projectCode: projectCodeA,
                    requiredQcCount: 0,
                })
                .returning();
            assertExists(target);

            const [sibling] = await db
                .insert(dossiers)
                .values({
                    folderId: leaf.id,
                    folderPath: cascadePath,
                    name: "cascade-sibling",
                    entityType: EntityType.DOCUMENT,
                    status: DossierStatus.READY_FOR_ENTRY,
                    projectCode: null,
                    requiredQcCount: 0,
                })
                .returning();
            assertExists(sibling);

            const updated = await DossierService.update(target.id, {
                projectCode: projectCodeB,
            });
            assertEquals(updated.projectCode, projectCodeB);

            const siblingRow = await db.query.dossiers.findFirst({
                where: eq(dossiers.id, sibling.id),
            });
            assertEquals(siblingRow?.projectCode, projectCodeB);

            const leafFolder = await db.query.folders.findFirst({
                where: eq(folders.id, leaf.id),
            });
            assertEquals(leafFolder?.projectCode, projectCodeB);
        });
    } finally {
        setStorageStatOverrideForTests(null);
        for (const prefix of prefixes) {
            await cleanupByPrefix(prefix);
        }
        await deleteTestProject(projectCodeA);
        await deleteTestProject(projectCodeB);
    }
});
