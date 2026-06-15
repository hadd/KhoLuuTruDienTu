import { eq } from "drizzle-orm";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { httpError } from "@shared/common-lib";
import {
    deriveFolderPathFromProcessedKey,
    normalizeStorageKey,
} from "../dossier/dossier-path-utils.ts";
import { emitOcrCompleted } from "../../libs/socket-io.ts";
import { recordSnapshot, hasOcrCompletedHistory } from "../metadata-history/metadata-history-service.ts";

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

    const normalizedOutputPath = normalizeStorageKey(output_path);

    const txResult = await db.transaction(async (tx) => {
        const [locked] = await tx
            .select({
                id: dossiers.id,
                status: dossiers.status,
                ocrMetadataKey: dossiers.ocrMetadataKey,
                folderId: dossiers.folderId,
            })
            .from(dossiers)
            .where(eq(dossiers.id, dossier.id))
            .for("update");

        if (!locked) {
            throw httpError.notFound(`Dossier not found: ${dossier.id}`);
        }

        // Idempotent: OCR metadata đã được gán — không cập nhật lại, không ghi lịch sử.
        if (locked.ocrMetadataKey) {
            return {
                applied: false as const,
                dossierId: locked.id,
                folderId: locked.folderId,
                fromStatus: locked.status,
                status: locked.status,
                ocrMetadataKey: locked.ocrMetadataKey,
            };
        }

        const fromStatus = locked.status;
        const updateSet: Partial<typeof dossiers.$inferInsert> = {
            ocrMetadataKey: normalizedOutputPath,
            currentMetadataKey: normalizedOutputPath,
            updatedAt: new Date(),
        };

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
            .where(eq(dossiers.id, locked.id));

        await tx.insert(workflowLogs).values({
            dossierId: locked.id,
            actorId: null,
            action: "OCR_COMPLETED",
            fromStatus,
            toStatus: updateSet.status ?? fromStatus,
            notes: `OCR metadata saved: ${normalizedOutputPath}`,
        });

        const status = advanceableStatuses.includes(fromStatus)
            ? DossierStatus.READY_FOR_ENTRY
            : fromStatus;

        return {
            applied: true as const,
            dossierId: locked.id,
            folderId: locked.folderId,
            fromStatus,
            status,
            ocrMetadataKey: normalizedOutputPath,
        };
    });

    if (!txResult.applied) {
        if (!await hasOcrCompletedHistory(txResult.dossierId)) {
            await recordSnapshot({
                dossierId: txResult.dossierId,
                actorId: null,
                role: null,
                action: "OCR_COMPLETED",
                fromStatus: txResult.fromStatus,
                toStatus: txResult.status,
                s3Key: txResult.ocrMetadataKey,
                notes: `OCR metadata backfill: ${txResult.ocrMetadataKey}`,
            }).catch((err) => {
                console.error("[MetadataHistory] Failed to backfill OCR snapshot:", err);
            });
        }

        return {
            dossierId: txResult.dossierId,
            folderPath,
            ocrMetadataKey: txResult.ocrMetadataKey,
            status: txResult.status,
        };
    }

    emitOcrCompleted({
        dossierId: txResult.dossierId,
        folderId: txResult.folderId,
        folderPath,
        status: txResult.status,
        fromStatus: txResult.fromStatus,
        ocrMetadataKey: txResult.ocrMetadataKey,
    });

    recordSnapshot({
        dossierId: txResult.dossierId,
        actorId: null,
        role: null,
        action: "OCR_COMPLETED",
        fromStatus: txResult.fromStatus,
        toStatus: txResult.status,
        s3Key: txResult.ocrMetadataKey,
        notes: `OCR metadata saved: ${txResult.ocrMetadataKey}`,
    }).catch((err) => {
        console.error("[MetadataHistory] Failed to record OCR snapshot:", err);
    });

    return {
        dossierId: txResult.dossierId,
        folderPath,
        ocrMetadataKey: txResult.ocrMetadataKey,
        status: txResult.status,
    };
}
