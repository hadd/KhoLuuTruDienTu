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
import { GLOBAL_BROWSE_SCOPE } from "../modules/folder/folder-browse-scope.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";

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
    await db
      .delete(dossierAssignments)
      .where(inArray(dossierAssignments.dossierId, ids.dossierIds));
    await db.delete(dossiers).where(inArray(dossiers.id, ids.dossierIds));
  }
  if (ids.userIds.length > 0) {
    await db.delete(userProfiles).where(inArray(userProfiles.id, ids.userIds));
  }
  if (ids.folderIds.length > 0) {
    await db.delete(folders).where(inArray(folders.id, ids.folderIds));
  }
}

Deno.test(
  {
    name: "Folder Integration Tests",
    sanitizeResources: false,
    sanitizeOps: false,
  },
  async (t) => {
    const project = await createTestProject();
    const projectCode = project.projectCode;
    const ids: CreatedIds = {
      folderIds: [],
      dossierIds: [],
      fileIds: [],
      userIds: [],
    };

    const rootAPath = `${TEST_PREFIX}/root-a`;
    const rootBPath = `${TEST_PREFIX}/root-b`;
    const childPath = `${TEST_PREFIX}/root-a/child`;
    const leafPath = `${TEST_PREFIX}/root-a/leaf`;
    const mixedPath = `${TEST_PREFIX}/root-a/mixed`;

    try {
      const rootA = await FolderService.create({
        folderPath: rootAPath,
        folderName: "root-a",
        projectCode,
      });
      const rootB = await FolderService.create({
        folderPath: rootBPath,
        folderName: "root-b",
        projectCode,
      });
      ids.folderIds.push(rootA.id, rootB.id);

      await t.step("listAllParents includes test root folders", async () => {
        const result = await FolderService.listAllParents(GLOBAL_BROWSE_SCOPE);
        assertEquals(result.nodeType, FolderBrowseNodeType.FOLDER);

        const testRoots = result.children.filter(
          (f) => f.folderPath === rootAPath || f.folderPath === rootBPath,
        );
        assertEquals(testRoots.length, 2);
      });

      const child = await FolderService.create({
        parentId: rootA.id,
        folderPath: childPath,
        folderName: "child",
        projectCode,
      });
      ids.folderIds.push(child.id);

      await t.step(
        "listAllFirstSubfolders returns subfolders when present",
        async () => {
          const result = await FolderService.listAllFirstSubfolders(
            rootA.id,
            GLOBAL_BROWSE_SCOPE,
          );
          assertEquals(result.nodeType, FolderBrowseNodeType.FOLDER);
          assertEquals(result.parentId, rootA.id);
          assertEquals(result.totalSizeKb, 0);
          assertEquals(result.children.length, 1);
          assertEquals(result.children[0]?.folderName, "child");
          assertEquals(result.children[0]?.totalSizeKb, 0);
          assertEquals(result.children[0]?.isAssigned, false);
          assertEquals("status" in (result.children[0] ?? {}), false);
        },
      );

      const leaf = await FolderService.create({
        parentId: rootA.id,
        folderPath: leafPath,
        folderName: "leaf",
        projectCode,
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

      await t.step(
        "listAllFirstSubfolders returns dossiers when no subfolders",
        async () => {
          const result = await FolderService.listAllFirstSubfolders(
            leaf.id,
            GLOBAL_BROWSE_SCOPE,
          );
          assertEquals(result.nodeType, FolderBrowseNodeType.DOSSIER);
          assertEquals(result.parentId, leaf.id);
          assertEquals(result.totalSizeKb, 0);
          assertEquals(result.children.length, 1);
          assertEquals(result.children[0]?.name, "ho-so-leaf");
          assertEquals(result.children[0]?.isAssigned, false);
          assertEquals(result.children[0]?.totalSizeKb, 0);
        },
      );

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
        projectCode,
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
        projectCode,
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

      await t.step(
        "listAllFirstSubfolders returns totalSizeKb from files table",
        async () => {
          const result = await FolderService.listAllFirstSubfolders(
            leaf.id,
            GLOBAL_BROWSE_SCOPE,
          );
          assertEquals(result.totalSizeKb, 10);
          assertEquals(result.children[0]?.totalSizeKb, 10);
        },
      );

      await t.step(
        "listAllFirstSubfolders prioritizes subfolders over dossiers",
        async () => {
          const result = await FolderService.listAllFirstSubfolders(
            mixed.id,
            GLOBAL_BROWSE_SCOPE,
          );
          assertEquals(result.nodeType, FolderBrowseNodeType.FOLDER);
          assertEquals(result.children.length, 1);
          assertEquals(result.children[0]?.folderName, "sub");
          assertEquals(result.children[0]?.totalSizeKb, 20);
          assertEquals(result.children[0]?.isAssigned, false);
          assertEquals(result.totalSizeKb, 20);
        },
      );

      await t.step(
        "listAllFirstSubfolders sums nested folder sizes recursively",
        async () => {
          const result = await FolderService.listAllFirstSubfolders(
            rootA.id,
            GLOBAL_BROWSE_SCOPE,
          );
          const mixedNode = result.children.find(
            (item) => item.folderName === "mixed",
          );
          assertExists(mixedNode);
          assertEquals(mixedNode.totalSizeKb, 20);
          assertEquals(mixedNode.isAssigned, false);
          assertEquals(result.totalSizeKb, 30);
        },
      );

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

      await t.step(
        "listAllFirstSubfolders includes dossier status on subfolders",
        async () => {
          const result = await FolderService.listAllFirstSubfolders(
            rootA.id,
            GLOBAL_BROWSE_SCOPE,
          );
          assertEquals(result.nodeType, FolderBrowseNodeType.FOLDER);

          const childNode = result.children.find(
            (item) => item.folderName === "child",
          );
          assertExists(childNode);
          assertEquals(childNode.dossierId, childDossier.id);
          assertEquals(childNode.status, DossierStatus.READY_FOR_ENTRY);
          assertEquals(childNode.isAssigned, false);
          assertEquals(childNode.totalSizeKb, 0);

          const leafNode = result.children.find(
            (item) => item.folderName === "leaf",
          );
          assertExists(leafNode);
          assertEquals(leafNode.dossierId, dossier.id);
          assertEquals(leafNode.status, DossierStatus.NEW);
          assertEquals(leafNode.isAssigned, false);
          assertEquals(leafNode.totalSizeKb, 10);

          assertEquals(result.totalSizeKb, 30);
        },
      );

      await t.step(
        "listAllFirstSubfolders includes isAssigned when dossier is assigned",
        async () => {
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

          const byAssignment = await FolderService.listAllFirstSubfolders(
            rootA.id,
            GLOBAL_BROWSE_SCOPE,
          );
          const assignedByMaker = byAssignment.children.find(
            (item) => item.folderName === "child",
          );
          assertExists(assignedByMaker);
          assertEquals(assignedByMaker.isAssigned, true);

          const dossierList = await FolderService.listAllFirstSubfolders(
            child.id,
            GLOBAL_BROWSE_SCOPE,
          );
          assertEquals(dossierList.nodeType, FolderBrowseNodeType.DOSSIER);
          assertEquals(dossierList.children[0]?.isAssigned, true);

          const mixedAfterPartialAssign =
            await FolderService.listAllFirstSubfolders(
              rootA.id,
              GLOBAL_BROWSE_SCOPE,
            );
          const mixedNode = mixedAfterPartialAssign.children.find(
            (item) => item.folderName === "mixed",
          );
          assertExists(mixedNode);
          assertEquals(mixedNode.isAssigned, false);
        },
      );

      await t.step(
        "listAllFirstSubfolders isAssigned true only when all subtree dossiers are assigned",
        async () => {
          await db.insert(dossierAssignments).values([
            {
              dossierId: mixedDossier.id,
              assigneeId: ids.userIds[0]!,
              role: WorkerRole.MAKER,
              status: AssignmentStatus.IN_PROGRESS,
            },
            {
              dossierId: nestedDossier.id,
              assigneeId: ids.userIds[0]!,
              role: WorkerRole.MAKER,
              status: AssignmentStatus.IN_PROGRESS,
            },
          ]);

          const mixedResult = await FolderService.listAllFirstSubfolders(
            mixed.id,
            GLOBAL_BROWSE_SCOPE,
          );
          assertEquals(mixedResult.children[0]?.isAssigned, true);

          const rootResult = await FolderService.listAllFirstSubfolders(
            rootA.id,
            GLOBAL_BROWSE_SCOPE,
          );
          const mixedNode = rootResult.children.find(
            (item) => item.folderName === "mixed",
          );
          assertExists(mixedNode);
          assertEquals(mixedNode.isAssigned, true);

          const childNode = rootResult.children.find(
            (item) => item.folderName === "child",
          );
          assertExists(childNode);
          assertEquals(childNode.isAssigned, true);

          const leafNode = rootResult.children.find(
            (item) => item.folderName === "leaf",
          );
          assertExists(leafNode);
          assertEquals(leafNode.isAssigned, false);
        },
      );

      await t.step(
        "listAllFirstSubfolders managed scope shows managed project",
        async () => {
          const result = await FolderService.listAllFirstSubfolders(rootA.id, {
            mode: "managed",
            projectCodes: [projectCode],
          });
          assertEquals(result.nodeType, FolderBrowseNodeType.FOLDER);
          assertEquals(
            result.children.some((item) => item.folderName === "child"),
            true,
          );
        },
      );

      await t.step(
        "listAllFirstSubfolders managed scope with no projects hides folder",
        async () => {
          try {
            await FolderService.listAllFirstSubfolders(rootA.id, {
              mode: "managed",
              projectCodes: [],
            });
            throw new Error("expected not found");
          } catch (error) {
            assertEquals(error instanceof Error, true);
            assertEquals((error as Error).message, "Folder not found");
          }
        },
      );

      await t.step(
        "listAllFirstSubfolders single scope filters by project",
        async () => {
          const result = await FolderService.listAllFirstSubfolders(rootA.id, {
            mode: "single",
            projectCode,
          });
          assertEquals(result.projectCode, projectCode);
          assertEquals(
            result.children.some((item) => item.folderName === "child"),
            true,
          );
        },
      );

      await t.step(
        "listAllFirstSubfolders single scope rejects mismatched project",
        async () => {
          const otherProject = await createTestProject();
          try {
            await FolderService.listAllFirstSubfolders(rootA.id, {
              mode: "single",
              projectCode: otherProject.projectCode,
            });
            throw new Error("expected not found");
          } catch (error) {
            assertEquals(error instanceof Error, true);
            assertEquals((error as Error).message, "Folder not found");
          } finally {
            await deleteTestProject(otherProject.projectCode);
          }
        },
      );

      await t.step(
        "listAllFirstSubfolders managed scope excluding project hides folder",
        async () => {
          const otherProject = await createTestProject();
          try {
            await FolderService.listAllFirstSubfolders(rootA.id, {
              mode: "managed",
              projectCodes: [otherProject.projectCode],
            });
            throw new Error("expected not found");
          } catch (error) {
            assertEquals(error instanceof Error, true);
            assertEquals((error as Error).message, "Folder not found");
          } finally {
            await deleteTestProject(otherProject.projectCode);
          }
        },
      );

      await t.step(
        "listAllFirstSubfolders managed scope hides unscoped raw subfolders while global keeps them",
        async () => {
          const rawChildPath = `raw/${TEST_PREFIX}/root-a/unscoped-child`;
          const [rawChild] = await db
            .insert(folders)
            .values({
              parentId: rootA.id,
              folderPath: rawChildPath,
              folderName: "unscoped-child",
              projectCode: null,
            })
            .returning();
          ids.folderIds.push(rawChild.id);

          const managedResult = await FolderService.listAllFirstSubfolders(
            rootA.id,
            { mode: "managed", projectCodes: [projectCode] },
          );
          assertEquals(
            managedResult.children.some((item) => item.folderName === "child"),
            true,
          );
          assertEquals(
            managedResult.children.some(
              (item) => item.folderName === "unscoped-child",
            ),
            false,
          );

          const globalResult = await FolderService.listAllFirstSubfolders(
            rootA.id,
            GLOBAL_BROWSE_SCOPE,
          );
          assertEquals(
            globalResult.children.some(
              (item) => item.folderName === "unscoped-child",
            ),
            true,
          );
        },
      );

      await t.step(
        "listAllFirstSubfolders single scope hides unscoped raw subfolders while global keeps them",
        async () => {
          const rawChildPath = `raw/${TEST_PREFIX}/scoped-root/raw-child`;
          const scopedRoot = await FolderService.create({
            folderPath: `${TEST_PREFIX}/scoped-root`,
            folderName: "scoped-root",
            projectCode,
          });
          const [rawChild] = await db
            .insert(folders)
            .values({
              parentId: scopedRoot.id,
              folderPath: rawChildPath,
              folderName: "raw-child",
              projectCode: null,
            })
            .returning();
          ids.folderIds.push(scopedRoot.id, rawChild.id);

          const singleResult = await FolderService.listAllFirstSubfolders(
            scopedRoot.id,
            {
              mode: "single",
              projectCode,
            },
          );
          assertEquals(
            singleResult.children.some(
              (item) => item.folderName === "raw-child",
            ),
            false,
          );

          const globalResult = await FolderService.listAllFirstSubfolders(
            scopedRoot.id,
            GLOBAL_BROWSE_SCOPE,
          );
          assertEquals(
            globalResult.children.some(
              (item) => item.folderName === "raw-child",
            ),
            true,
          );
        },
      );

      await t.step(
        "listAllParents managed scope returns only managed project roots",
        async () => {
          const otherProject = await createTestProject();
          const otherRootPath = `${TEST_PREFIX}/other-root`;
          const otherRoot = await FolderService.create({
            folderPath: otherRootPath,
            folderName: "other-root",
            projectCode: otherProject.projectCode,
          });
          ids.folderIds.push(otherRoot.id);

          try {
            const managedParents = await FolderService.listAllParents({
              mode: "managed",
              projectCodes: [projectCode],
            });
            const paths = managedParents.children.map(
              (item) => item.folderPath,
            );
            assertEquals(paths.includes(rootAPath), true);
            assertEquals(paths.includes(otherRootPath), false);
          } finally {
            await db.delete(folders).where(eq(folders.id, otherRoot.id));
            ids.folderIds = ids.folderIds.filter((id) => id !== otherRoot.id);
            await deleteTestProject(otherProject.projectCode);
          }
        },
      );
    } finally {
      await cleanupTestData(ids);
      await deleteTestProject(projectCode);
    }
  },
);
