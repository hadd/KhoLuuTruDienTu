import { eq } from "drizzle-orm";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { httpError } from "@shared/common-lib";
import { deriveFolderPathFromProcessedKey } from "../dossier/dossier-path-utils.ts";
import { emitOcrCompleted } from "../../libs/socket-io.ts";

/**
 * Derive the dossier folderPath from the MinIO output_path produced by the
 * Python metadata worker.
 *
 * Convention:
 *   output_path  = "processed/<root_folder>/<ho_so_id>/<ho_so_id>.json"
 *   folderPath   = "<rawPrefix>/<root_folder>/<ho_so_id>"
 *
 * The raw prefix defaults to "raw" and can be overridden via STORAGE_RAW_PREFIX.
 */

export async function handleOcrCallback(input: {
    ho_so_id: string;
    output_path: string;
}) {
    const { output_path } = input;

    const folderPath = deriveFolderPathFromProcessedKey(output_path);

    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.folderPath, folderPath)),
    });

    if (!dossier) {
        throw httpError.notFound(
            `Dossier not found for folderPath: ${folderPath}`,
        );
    }

    const fromStatus = dossier.status;

    await db.transaction(async (tx) => {
        const updateSet: Partial<typeof dossiers.$inferInsert> = {
            ocrMetadataKey: output_path,
            currentMetadataKey: output_path,
            updatedAt: new Date(),
        };

        // Advance status to READY_FOR_ENTRY when dossier is in NEW or OCR_PROCESSING.
        // If it has moved further (already assigned, in QC, etc.),
        // keep the current status to avoid rolling back progress.
        const advanceableStatuses: DossierStatus[] = [
            DossierStatus.NEW,
            DossierStatus.OCR_PROCESSING,
            DossierStatus.OCR_FAILED,
        ];
        if (advanceableStatuses.includes(fromStatus)) {
            updateSet.status = DossierStatus.READY_FOR_ENTRY;
        }

        await tx
            .update(dossiers)
            .set(updateSet)
            .where(eq(dossiers.id, dossier.id));

        await tx.insert(workflowLogs).values({
            dossierId: dossier.id,
            actorId: null,
            action: "OCR_COMPLETED",
            fromStatus,
            toStatus: updateSet.status ?? fromStatus,
            notes: `OCR metadata saved: ${output_path}`,
        });
    });

    const advanceableStatuses: DossierStatus[] = [
        DossierStatus.NEW,
        DossierStatus.OCR_PROCESSING,
        DossierStatus.OCR_FAILED,
    ];
    const status = advanceableStatuses.includes(fromStatus)
        ? DossierStatus.READY_FOR_ENTRY
        : fromStatus;

    emitOcrCompleted({
        dossierId: dossier.id,
        folderId: dossier.folderId,
        folderPath,
        status,
        fromStatus,
        ocrMetadataKey: output_path,
    });

    return {
        dossierId: dossier.id,
        folderPath,
        ocrMetadataKey: output_path,
        status,
    };
}
