import { assertEquals, assertExists } from "@std/assert";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierAssignments } from "../db/schemas/dossier-assignment.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import { userProfiles } from "../db/schemas/user_profile.ts";
import {
    AssignmentStatus,
    DossierStatus,
    EntityType,
    WorkerRole,
} from "../db/schemas/workflow-constants.ts";
import { FolderBrowseNodeType } from "../modules/folder/folder-browse-constants.ts";
import { FolderService } from "../modules/folder/folder-service.ts";

const TEST_PREFIX = `test-folder/${crypto.randomUUID()}`;

type CreatedIds = {
    folderIds: string[];
    dossierIds: string[];
    fileIds: string[];
    userIds: string[];
};

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
    if (ids.userIds.length > 0) {
        await db.delete(userProfiles).where(inArray(userProfiles.id, ids.userIds));
    }
    if (ids.folderIds.length > 0) {
        await db.delete(folders).where(inArray(folders.id, ids.folderIds));
    }
}

Deno.test("Folder Integration Tests", async (t) => {
    const ids: CreatedIds = { folderIds: [], dossierIds: [], fileIds: [], userIds: [] };

    const rootAPath = `${TEST_PREFIX}/root-a`;
    const rootBPath = `${TEST_PREFIX}/root-b`;
    const childPath = `${TEST_PREFIX}/root-a/child`;
    const leafPath = `${TEST_PREFIX}/root-a/leaf`;
    const mixedPath = `${TEST_PREFIX}/root-a/mixed`;

    try {
        const rootA = await FolderService.create({
            folderPath: rootAPath,
            folderName: "root-a",
        });
        const rootB = await FolderService.create({
            folderPath: rootBPath,
            folderName: "root-b",
        });
        ids.folderIds.push(rootA.id, rootB.id);

        await t.step("listAllParents includes test root folders", async () => {
            const result = await FolderService.listAllParents();
            assertEquals(result.nodeType, FolderBrowseNodeType.FOLDER);

            const testRoots = result.children.filter((f) =>
                f.folderPath === rootAPath || f.folderPath === rootBPath
            );
            assertEquals(testRoots.length, 2);
        });

        const child = await FolderService.create({
            parentId: rootA.id,
            folderPath: childPath,
            folderName: "child",
        });
        ids.folderIds.push(child.id);

        await t.step("listAllFirstSubfolders returns subfolders when present", async () => {
            const result = await FolderService.listAllFirstSubfolders(rootA.id);
            assertEquals(result.nodeType, FolderBrowseNodeType.FOLDER);
            assertEquals(result.parentId, rootA.id);
            assertEquals(result.totalSizeKb, 0);
            assertEquals(result.children.length, 1);
            assertEquals(result.children[0]?.folderName, "child");
            assertEquals(result.children[0]?.totalSizeKb, 0);
            assertEquals("status" in (result.children[0] ?? {}), false);
        });

        const leaf = await FolderService.create({
            parentId: rootA.id,
            folderPath: leafPath,
            folderName: "leaf",
        });
        ids.folderIds.push(leaf.id);

        const [dossier] = await db
            .insert(dossiers)
            .values({
                folderId: leaf.id,
                folderPath: leafPath,
                name: "ho-so-leaf",
                entityType: EntityType.DOCUMENT,
                status: DossierStatus.NEW,
            })
            .returning();
        assertExists(dossier);
        ids.dossierIds.push(dossier.id);

        await t.step("listAllFirstSubfolders returns dossiers when no subfolders", async () => {
            const result = await FolderService.listAllFirstSubfolders(leaf.id);
            assertEquals(result.nodeType, FolderBrowseNodeType.DOSSIER);
            assertEquals(result.parentId, leaf.id);
            assertEquals(result.totalSizeKb, 0);
            assertEquals(result.children.length, 1);
            assertEquals(result.children[0]?.name, "ho-so-leaf");
            assertEquals(result.children[0]?.isAssigned, false);
            assertEquals(result.children[0]?.totalSizeKb, 0);
        });

        const [file] = await db
            .insert(dossierFiles)
            .values({
                dossierId: dossier.id,
                fileName: "scan.pdf",
                filePath: `${leafPath}/scan.pdf`,
                fileSizeKb: 10,
            })
            .returning();
        assertExists(file);
        ids.fileIds.push(file.id);

        await t.step("listDossierFiles returns files for dossier", async () => {
            const result = await FolderService.listDossierFiles(dossier.id);
            assertEquals(result.nodeType, FolderBrowseNodeType.FILE);
            assertEquals(result.dossierId, dossier.id);
            assertEquals(result.children.length, 1);
            assertEquals(result.children[0]?.fileName, "scan.pdf");
        });

        const mixed = await FolderService.create({
            parentId: rootA.id,
            folderPath: mixedPath,
            folderName: "mixed",
        });
        ids.folderIds.push(mixed.id);

        const [mixedDossier] = await db
            .insert(dossiers)
            .values({
                folderId: mixed.id,
                folderPath: mixedPath,
                name: "ho-so-mixed",
                entityType: EntityType.DOCUMENT,
                status: DossierStatus.NEW,
            })
            .returning();
        assertExists(mixedDossier);
        ids.dossierIds.push(mixedDossier.id);

        const mixedChild = await FolderService.create({
            parentId: mixed.id,
            folderPath: `${mixedPath}/sub`,
            folderName: "sub",
        });
        ids.folderIds.push(mixedChild.id);

        const [nestedDossier] = await db
            .insert(dossiers)
            .values({
                folderId: mixedChild.id,
                folderPath: `${mixedPath}/sub`,
                name: "ho-so-nested",
                entityType: EntityType.DOCUMENT,
                status: DossierStatus.NEW,
            })
            .returning();
        assertExists(nestedDossier);
        ids.dossierIds.push(nestedDossier.id);

        const [nestedFile] = await db
            .insert(dossierFiles)
            .values({
                dossierId: nestedDossier.id,
                fileName: "nested.pdf",
                filePath: `${mixedPath}/sub/nested.pdf`,
                fileSizeKb: 20,
            })
            .returning();
        assertExists(nestedFile);
        ids.fileIds.push(nestedFile.id);

        await t.step("listAllFirstSubfolders returns totalSizeKb from files table", async () => {
            const result = await FolderService.listAllFirstSubfolders(leaf.id);
            assertEquals(result.totalSizeKb, 10);
            assertEquals(result.children[0]?.totalSizeKb, 10);
        });

        await t.step("listAllFirstSubfolders prioritizes subfolders over dossiers", async () => {
            const result = await FolderService.listAllFirstSubfolders(mixed.id);
            assertEquals(result.nodeType, FolderBrowseNodeType.FOLDER);
            assertEquals(result.children.length, 1);
            assertEquals(result.children[0]?.folderName, "sub");
            assertEquals(result.children[0]?.totalSizeKb, 20);
            assertEquals(result.totalSizeKb, 20);
        });

        await t.step("listAllFirstSubfolders sums nested folder sizes recursively", async () => {
            const result = await FolderService.listAllFirstSubfolders(rootA.id);
            const mixedNode = result.children.find((item) => item.folderName === "mixed");
            assertExists(mixedNode);
            assertEquals(mixedNode.totalSizeKb, 20);
            assertEquals(result.totalSizeKb, 30);
        });

        const [childDossier] = await db
            .insert(dossiers)
            .values({
                folderId: child.id,
                folderPath: childPath,
                name: "ho-so-child",
                entityType: EntityType.DOCUMENT,
                status: DossierStatus.READY_FOR_ENTRY,
            })
            .returning();
        assertExists(childDossier);
        ids.dossierIds.push(childDossier.id);

        await t.step("listAllFirstSubfolders includes dossier status on subfolders", async () => {
            const result = await FolderService.listAllFirstSubfolders(rootA.id);
            assertEquals(result.nodeType, FolderBrowseNodeType.FOLDER);

            const childNode = result.children.find((item) => item.folderName === "child");
            assertExists(childNode);
            assertEquals(childNode.dossierId, childDossier.id);
            assertEquals(childNode.status, DossierStatus.READY_FOR_ENTRY);
            assertEquals(childNode.isAssigned, false);
            assertEquals(childNode.totalSizeKb, 0);

            const leafNode = result.children.find((item) => item.folderName === "leaf");
            assertExists(leafNode);
            assertEquals(leafNode.dossierId, dossier.id);
            assertEquals(leafNode.status, DossierStatus.NEW);
            assertEquals(leafNode.isAssigned, false);
            assertEquals(leafNode.totalSizeKb, 10);

            assertEquals(result.totalSizeKb, 30);
        });

        await t.step("listAllFirstSubfolders includes isAssigned when dossier is assigned", async () => {
            const [editor] = await db
                .insert(userProfiles)
                .values({
                    email: `${TEST_PREFIX}-editor@test.local`,
                    fullName: "Folder Test Editor",
                })
                .returning();
            assertExists(editor);
            ids.userIds.push(editor.id);

            await db.insert(dossierAssignments).values({
                dossierId: childDossier.id,
                assigneeId: editor.id,
                role: WorkerRole.MAKER,
                status: AssignmentStatus.IN_PROGRESS,
            });

            const byAssignment = await FolderService.listAllFirstSubfolders(rootA.id);
            const assignedByMaker = byAssignment.children.find((item) => item.folderName === "child");
            assertExists(assignedByMaker);
            assertEquals(assignedByMaker.isAssigned, true);

            const dossierList = await FolderService.listAllFirstSubfolders(child.id);
            assertEquals(dossierList.nodeType, FolderBrowseNodeType.DOSSIER);
            assertEquals(dossierList.children[0]?.isAssigned, true);
        });
    } finally {
        await cleanupTestData(ids);
    }
});
