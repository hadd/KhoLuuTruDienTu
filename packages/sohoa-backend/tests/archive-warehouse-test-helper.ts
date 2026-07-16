import { eq, inArray } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import { fonds } from "../db/schemas/fond.ts";
import { EntityType, DossierStatus } from "../db/schemas/workflow-constants.ts";

export type ArchiveWarehouseTestFixture = {
    prefix: string;
    fondId: string;
    sourceDossierId: string;
    targetDossierId: string;
    sourceFolderPath: string;
    targetFolderPath: string;
    sourceFileToMoveId: string;
    sourceFileToMovePath: string;
    sourceSecondFileId: string;
    targetCollisionFileId: string;
    targetCollisionPath: string;
};

export async function createArchiveWarehouseMoveFixture(
    prefix: string,
    projectCode: string | null = null,
): Promise<ArchiveWarehouseTestFixture> {
    const fondId = `${prefix}-fond`;
    const sourceFolderPath = `${prefix}/source-dossier`;
    const targetFolderPath = `${prefix}/target-dossier`;

    await db.insert(fonds).values({
        id: fondId,
        fondName: `Test Fond ${prefix}`,
        archiveAgency: "Test Agency",
        adminstrativeHistory: "Test history",
        fondType: "Test",
    }).onConflictDoNothing();

    const [sourceFolder] = await db.insert(folders).values({
        folderPath: sourceFolderPath,
        folderName: "source-dossier",
        projectCode,
    }).returning();

    const [targetFolder] = await db.insert(folders).values({
        folderPath: targetFolderPath,
        folderName: "target-dossier",
        projectCode,
    }).returning();

    const [sourceDossier] = await db.insert(dossiers).values({
        folderId: sourceFolder.id,
        folderPath: sourceFolderPath,
        name: "source-dossier",
        projectCode,
        entityType: EntityType.DOSSIER,
        status: DossierStatus.ARCHIVED,
        fondId,
    }).returning();

    const [targetDossier] = await db.insert(dossiers).values({
        folderId: targetFolder.id,
        folderPath: targetFolderPath,
        name: "target-dossier",
        projectCode,
        entityType: EntityType.DOSSIER,
        status: DossierStatus.ARCHIVED,
        fondId,
    }).returning();

    const sourceFileToMovePath = `${sourceFolderPath}/move-me.pdf`;
    const sourceSecondFilePath = `${sourceFolderPath}/keep-me.pdf`;
    const targetCollisionPath = `${targetFolderPath}/move-me.pdf`;

    const [sourceFileToMove] = await db.insert(dossierFiles).values({
        dossierId: sourceDossier.id,
        fileName: "move-me.pdf",
        filePath: sourceFileToMovePath,
        fileSizeKb: 10,
    }).returning();

    const [sourceSecondFile] = await db.insert(dossierFiles).values({
        dossierId: sourceDossier.id,
        fileName: "keep-me.pdf",
        filePath: sourceSecondFilePath,
        fileSizeKb: 10,
    }).returning();

    const [targetCollisionFile] = await db.insert(dossierFiles).values({
        dossierId: targetDossier.id,
        fileName: "move-me.pdf",
        filePath: targetCollisionPath,
        fileSizeKb: 10,
    }).returning();

    return {
        prefix,
        fondId,
        sourceDossierId: sourceDossier.id,
        targetDossierId: targetDossier.id,
        sourceFolderPath,
        targetFolderPath,
        sourceFileToMoveId: sourceFileToMove.id,
        sourceFileToMovePath,
        sourceSecondFileId: sourceSecondFile.id,
        targetCollisionFileId: targetCollisionFile.id,
        targetCollisionPath,
    };
}

export async function deleteArchiveWarehouseMoveFixture(
    fixture: ArchiveWarehouseTestFixture,
): Promise<void> {
    const dossierIds = [fixture.sourceDossierId, fixture.targetDossierId];
    const filePaths = [
        fixture.sourceFileToMovePath,
        `${fixture.sourceFolderPath}/keep-me.pdf`,
        fixture.targetCollisionPath,
    ];

    await db.delete(dossierFiles).where(inArray(dossierFiles.filePath, filePaths));
    await db.delete(dossiers).where(inArray(dossiers.id, dossierIds));
    await db.delete(folders).where(inArray(folders.folderPath, [
        fixture.sourceFolderPath,
        fixture.targetFolderPath,
    ]));
    await db.delete(fonds).where(eq(fonds.id, fixture.fondId));
}

export async function createSingleFileArchivedDossier(input: {
    prefix: string;
    fondId: string;
    folderPath: string;
    dossierName: string;
    projectCode: string | null;
}) {
    const [folder] = await db.insert(folders).values({
        folderPath: input.folderPath,
        folderName: input.dossierName,
        projectCode: input.projectCode,
    }).returning();

    const [dossier] = await db.insert(dossiers).values({
        folderId: folder.id,
        folderPath: input.folderPath,
        name: input.dossierName,
        projectCode: input.projectCode,
        entityType: EntityType.DOSSIER,
        status: DossierStatus.ARCHIVED,
        fondId: input.fondId,
    }).returning();

    const filePath = `${input.folderPath}/only-file.pdf`;
    const [file] = await db.insert(dossierFiles).values({
        dossierId: dossier.id,
        fileName: "only-file.pdf",
        filePath,
        fileSizeKb: 5,
    }).returning();

    return { dossier, file, folder, filePath };
}
