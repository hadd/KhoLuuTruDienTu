import { assertEquals, assertRejects } from "@std/assert";
import { eq } from "drizzle-orm";
import { AppError } from "@shared/common-lib";
import { db } from "../db/db-conn.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import { EntityType, DossierStatus } from "../db/schemas/workflow-constants.ts";
import { resolveUniqueWarehouseDestinationPath } from "../modules/archive/archive-warehouse-path.ts";
import { setStorageObjectExistsOverrideForTests } from "../modules/archive/archive-warehouse-storage.ts";

const TEST_PREFIX = `test-wh-path/${crypto.randomUUID()}`;

async function createTestFolder(folderPath: string, projectCode: string | null) {
    const [folder] = await db.insert(folders).values({
        folderPath,
        folderName: folderPath.split("/").pop() ?? folderPath,
        projectCode,
    }).returning();
    return folder;
}

async function createTestDossier(input: {
    folderId: string;
    folderPath: string;
    name: string;
    projectCode: string | null;
}) {
    const [dossier] = await db.insert(dossiers).values({
        folderId: input.folderId,
        folderPath: input.folderPath,
        name: input.name,
        projectCode: input.projectCode,
        entityType: EntityType.DOSSIER,
        status: DossierStatus.ARCHIVED,
    }).returning();
    return dossier;
}

async function createTestFile(input: {
    dossierId: string;
    fileName: string;
    filePath: string;
}) {
    const [file] = await db.insert(dossierFiles).values({
        dossierId: input.dossierId,
        fileName: input.fileName,
        filePath: input.filePath,
        fileSizeKb: 1,
    }).returning();
    return file;
}

async function cleanupPathTestData(folderPath: string, filePaths: string[]) {
    for (const filePath of filePaths) {
        await db.delete(dossierFiles).where(eq(dossierFiles.filePath, filePath));
    }
    await db.delete(dossiers).where(eq(dossiers.folderPath, folderPath));
    await db.delete(folders).where(eq(folders.folderPath, folderPath));
}

Deno.test("resolveUniqueWarehouseDestinationPath returns original path when free", async () => {
    const folderPath = `${TEST_PREFIX}/free`;
    const filePath = `${folderPath}/doc.pdf`;
    setStorageObjectExistsOverrideForTests(async () => false);

    const folder = await createTestFolder(folderPath, null);

    try {
        const result = await resolveUniqueWarehouseDestinationPath({
            folderPath,
            fileName: "doc.pdf",
        });

        assertEquals(result.destPath, filePath);
        assertEquals(result.destFileName, "doc.pdf");
        assertEquals(result.renamed, false);
    } finally {
        setStorageObjectExistsOverrideForTests(null);
        await db.delete(folders).where(eq(folders.id, folder.id));
    }
});

Deno.test("resolveUniqueWarehouseDestinationPath renames when DB file_path exists", async () => {
    const folderPath = `${TEST_PREFIX}/db-collision`;
    const existingPath = `${folderPath}/doc.pdf`;
    setStorageObjectExistsOverrideForTests(async () => false);

    const folder = await createTestFolder(folderPath, null);
    const dossier = await createTestDossier({
        folderId: folder.id,
        folderPath,
        name: "db-collision",
        projectCode: null,
    });
    const existingFile = await createTestFile({
        dossierId: dossier.id,
        fileName: "doc.pdf",
        filePath: existingPath,
    });

    try {
        const result = await resolveUniqueWarehouseDestinationPath({
            folderPath,
            fileName: "doc.pdf",
            excludeFileId: existingFile.id,
        });

        assertEquals(result.renamed, false);
        assertEquals(result.destPath, existingPath);

        const resultWithCollision = await resolveUniqueWarehouseDestinationPath({
            folderPath,
            fileName: "doc.pdf",
        });

        assertEquals(resultWithCollision.renamed, true);
        assertEquals(resultWithCollision.destFileName.includes("doc.pdf"), true);
        assertEquals(resultWithCollision.destFileName !== "doc.pdf", true);
        assertEquals(resultWithCollision.destPath.startsWith(`${folderPath}/`), true);
    } finally {
        setStorageObjectExistsOverrideForTests(null);
        await cleanupPathTestData(folderPath, [existingPath]);
    }
});

Deno.test("resolveUniqueWarehouseDestinationPath renames when S3 orphan exists", async () => {
    const folderPath = `${TEST_PREFIX}/s3-collision`;
    const orphanPath = `${folderPath}/doc.pdf`;

    setStorageObjectExistsOverrideForTests(async (key) => key === orphanPath);

    try {
        const result = await resolveUniqueWarehouseDestinationPath({
            folderPath,
            fileName: "doc.pdf",
        });

        assertEquals(result.renamed, true);
        assertEquals(result.destPath !== orphanPath, true);
        assertEquals(result.destFileName.includes("doc.pdf"), true);
    } finally {
        setStorageObjectExistsOverrideForTests(null);
    }
});

Deno.test("resolveUniqueWarehouseDestinationPath generates distinct paths on repeated collisions", async () => {
    const folderPath = `${TEST_PREFIX}/multi-collision`;
    const takenPath = `${folderPath}/doc.pdf`;

    setStorageObjectExistsOverrideForTests(async (key) => key === takenPath);

    try {
        const first = await resolveUniqueWarehouseDestinationPath({
            folderPath,
            fileName: "doc.pdf",
        });
        const second = await resolveUniqueWarehouseDestinationPath({
            folderPath,
            fileName: "doc.pdf",
        });

        assertEquals(first.renamed, true);
        assertEquals(second.renamed, true);
        assertEquals(first.destPath !== second.destPath, true);
    } finally {
        setStorageObjectExistsOverrideForTests(null);
    }
});

Deno.test("resolveUniqueWarehouseDestinationPath throws after max retry attempts", async () => {
    setStorageObjectExistsOverrideForTests(async () => true);

    try {
        const error = await assertRejects(
            () => resolveUniqueWarehouseDestinationPath({
                folderPath: `${TEST_PREFIX}/max-retry`,
                fileName: "doc.pdf",
            }),
            AppError,
        ) as AppError;

        assertEquals(error.status, 400);
    } finally {
        setStorageObjectExistsOverrideForTests(null);
    }
});
