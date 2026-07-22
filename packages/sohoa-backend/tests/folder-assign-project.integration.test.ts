import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { eq, like } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import {
    DossierStatus,
    EntityType,
} from "../db/schemas/workflow-constants.ts";
import { getRawStoragePrefix } from "../modules/dossier/dossier-path-utils.ts";
import { FolderService } from "../modules/folder/folder-service.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";

function uniqueRoot(label: string) {
    return `fap-${label}-${crypto.randomUUID()}`;
}

async function cleanupByPrefix(prefix: string) {
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
    name: "Folder assign project cascade integration",
    sanitizeResources: false,
    sanitizeOps: false,
}, async (t) => {
    const projectA = await createTestProject();
    const projectB = await createTestProject();
    const projectCodeA = projectA.projectCode;
    const projectCodeB = projectB.projectCode;
    const prefixes: string[] = [];

    try {
        await t.step(
            "assigns project on parent folder to all eligible child dossiers",
            async () => {
                const root = uniqueRoot("cascade");
                prefixes.push(root);

                const [parent] = await db
                    .insert(folders)
                    .values({
                        parentId: null,
                        folderPath: root,
                        folderName: root,
                        projectCode: null,
                    })
                    .returning();
                assertExists(parent);

                const leafAPath = `${root}/hs-a`;
                const leafBPath = `${root}/hs-b`;

                const [leafA] = await db
                    .insert(folders)
                    .values({
                        parentId: parent.id,
                        folderPath: leafAPath,
                        folderName: "hs-a",
                        projectCode: null,
                    })
                    .returning();
                const [leafB] = await db
                    .insert(folders)
                    .values({
                        parentId: parent.id,
                        folderPath: leafBPath,
                        folderName: "hs-b",
                        projectCode: null,
                    })
                    .returning();
                assertExists(leafA);
                assertExists(leafB);

                const [dossierA] = await db
                    .insert(dossiers)
                    .values({
                        folderId: leafA.id,
                        folderPath: leafAPath,
                        name: "hs-a",
                        entityType: EntityType.DOCUMENT,
                        status: DossierStatus.NEW,
                        projectCode: null,
                        requiredQcCount: 0,
                    })
                    .returning();
                const [dossierB] = await db
                    .insert(dossiers)
                    .values({
                        folderId: leafB.id,
                        folderPath: leafBPath,
                        name: "hs-b",
                        entityType: EntityType.DOCUMENT,
                        status: DossierStatus.READY_FOR_ENTRY,
                        projectCode: null,
                        requiredQcCount: 0,
                    })
                    .returning();
                assertExists(dossierA);
                assertExists(dossierB);

                const updated = await FolderService.update(parent.id, {
                    projectCode: projectCodeA,
                });
                assertEquals(updated.projectCode, projectCodeA);

                const rowA = await db.query.dossiers.findFirst({
                    where: eq(dossiers.id, dossierA.id),
                });
                const rowB = await db.query.dossiers.findFirst({
                    where: eq(dossiers.id, dossierB.id),
                });
                assertEquals(rowA?.projectCode, projectCodeA);
                assertEquals(rowB?.projectCode, projectCodeA);

                const leafAFolder = await db.query.folders.findFirst({
                    where: eq(folders.id, leafA.id),
                });
                const leafBFolder = await db.query.folders.findFirst({
                    where: eq(folders.id, leafB.id),
                });
                assertEquals(leafAFolder?.projectCode, projectCodeA);
                assertEquals(leafBFolder?.projectCode, projectCodeA);
            },
        );

        await t.step(
            "rejects when a subtree dossier is not eligible",
            async () => {
                const root = uniqueRoot("conflict");
                prefixes.push(root);

                const [parent] = await db
                    .insert(folders)
                    .values({
                        parentId: null,
                        folderPath: root,
                        folderName: root,
                        projectCode: projectCodeA,
                    })
                    .returning();
                assertExists(parent);

                const leafPath = `${root}/blocked`;
                const [leaf] = await db
                    .insert(folders)
                    .values({
                        parentId: parent.id,
                        folderPath: leafPath,
                        folderName: "blocked",
                        projectCode: projectCodeA,
                    })
                    .returning();
                assertExists(leaf);

                await db.insert(dossiers).values({
                    folderId: leaf.id,
                    folderPath: leafPath,
                    name: "blocked",
                    entityType: EntityType.DOCUMENT,
                    status: DossierStatus.ENTRY_PROCESSING,
                    projectCode: projectCodeA,
                    requiredQcCount: 0,
                });

                const error = await assertRejects(() =>
                    FolderService.update(parent.id, {
                        projectCode: projectCodeB,
                    })
                );
                assertEquals((error as { status: number }).status, 409);
            },
        );

        await t.step("rejects assign on shared raw root", async () => {
            const rawPrefix = getRawStoragePrefix();
            let rawRoot = await db.query.folders.findFirst({
                where: eq(folders.folderPath, rawPrefix),
            });

            if (!rawRoot) {
                const [inserted] = await db
                    .insert(folders)
                    .values({
                        parentId: null,
                        folderPath: rawPrefix,
                        folderName: rawPrefix.split("/").filter(Boolean).at(-1) ??
                            "raw",
                        projectCode: null,
                    })
                    .returning();
                rawRoot = inserted;
            }
            assertExists(rawRoot);

            const error = await assertRejects(() =>
                FolderService.update(rawRoot!.id, {
                    projectCode: projectCodeA,
                })
            );
            assertEquals((error as { status: number }).status, 400);
        });
    } finally {
        for (const prefix of prefixes) {
            await cleanupByPrefix(prefix);
        }
        await deleteTestProject(projectCodeA);
        await deleteTestProject(projectCodeB);
    }
});
