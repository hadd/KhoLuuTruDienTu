import { assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import { fonds } from "../db/schemas/fond.ts";
import { EntityType, DossierStatus } from "../db/schemas/workflow-constants.ts";
import { reopenDossierForOcr } from "../modules/archive/archive-warehouse-reopen.ts";

const TEST_PREFIX = `test-wh-reopen/${crypto.randomUUID()}`;

async function createArchivedDossierWithFiles() {
    const fondId = `${TEST_PREFIX}-fond`;
    const folderPath = `${TEST_PREFIX}/dossier`;

    await db.insert(fonds).values({
        id: fondId,
        fondName: "Reopen test fond",
        archiveAgency: "Test Agency",
        adminstrativeHistory: "Test history",
        fondType: "Test",
    }).onConflictDoNothing();

    const [folder] = await db.insert(folders).values({
        folderPath,
        folderName: "dossier",
        projectCode: null,
    }).returning();

    const [dossier] = await db.insert(dossiers).values({
        folderId: folder.id,
        folderPath,
        name: "reopen-test",
        projectCode: null,
        entityType: EntityType.DOSSIER,
        status: DossierStatus.ARCHIVED,
        fondId,
    }).returning();

    await db.insert(dossierFiles).values([
        {
            dossierId: dossier.id,
            fileName: "doc-1.pdf",
            filePath: `${folderPath}/doc-1.pdf`,
            fileSizeKb: 10,
            ocrRunMode: "auto",
            ocrTriggerStatus: null,
        },
        {
            dossierId: dossier.id,
            fileName: "doc-2.pdf",
            filePath: `${folderPath}/doc-2.pdf`,
            fileSizeKb: 20,
            ocrRunMode: "manual",
            ocrTriggerStatus: "triggered",
        },
    ]);

    return { dossier, folderPath };
}

async function cleanupArchivedDossier(dossierId: string, folderPath: string, fondId: string) {
    await db.delete(dossierFiles).where(eq(dossierFiles.dossierId, dossierId));
    await db.delete(dossiers).where(eq(dossiers.id, dossierId));
    await db.delete(folders).where(eq(folders.folderPath, folderPath));
    await db.delete(fonds).where(eq(fonds.id, fondId));
}

Deno.test({
    name: "reopenDossierForOcr marks all files pending manual OCR",
    sanitizeResources: false,
    sanitizeOps: false,
}, async () => {
    const fondId = `${TEST_PREFIX}-fond`;
    const { dossier, folderPath } = await createArchivedDossierWithFiles();

    try {
        const result = await reopenDossierForOcr({
            dossierId: dossier.id,
            actorId: null,
            notes: "test reopen",
        });

        assertEquals(result.status, DossierStatus.NEW);
        assertEquals(result.fromStatus, DossierStatus.ARCHIVED);

        const files = await db
            .select({
                ocrRunMode: dossierFiles.ocrRunMode,
                ocrTriggerStatus: dossierFiles.ocrTriggerStatus,
                ocrTriggeredAt: dossierFiles.ocrTriggeredAt,
                ocrTriggeredBy: dossierFiles.ocrTriggeredBy,
            })
            .from(dossierFiles)
            .where(eq(dossierFiles.dossierId, dossier.id));

        assertEquals(files.length, 2);
        for (const file of files) {
            assertEquals(file.ocrRunMode, "manual");
            assertEquals(file.ocrTriggerStatus, "pending");
            assertEquals(file.ocrTriggeredAt, null);
            assertEquals(file.ocrTriggeredBy, null);
        }
    } finally {
        await cleanupArchivedDossier(dossier.id, folderPath, fondId);
    }
});
