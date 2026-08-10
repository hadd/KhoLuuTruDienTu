import { desc, eq, like, or } from "drizzle-orm";
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
import { scheduleOcrCompletedNotification } from "../notification/notification-delivery-service.ts";
import { recordSnapshot, hasOcrCompletedHistory } from "../metadata-history/metadata-history-service.ts";
import { enqueueDossierIndex } from "../search/search-index-queue.ts";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";

/** false chỉ khi chắc chắn object không tồn tại; lỗi khác (S3 down...) thì ném ra. */
async function processedJsonExists(key: string): Promise<boolean> {
    const s3 = await getS3Client();
    const bucket = env.S3?.bucket;
    if (!s3 || !bucket) return true;

    try {
        await s3.getMinIOClient().statObject(bucket, normalizeStorageKey(key));
        return true;
    } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === "NotFound" || code === "NoSuchKey") return false;
        throw error;
    }
}

/**
 * Prefer Kafka/API ho_so_id; fall back to deriving raw folderPath from output_path
 * (processed/ or tt05_metadata/, nested or flat like tt05_metadata/documents/documents.json).
 */
async function resolveDossierForOcrCallback(input: {
    ho_so_id: string;
    output_path: string;
}) {
    const hoSoId = input.ho_so_id.trim();
    if (hoSoId) {
        const byHoSoId = await db.query.dossiers.findFirst({
            where: activeDossierWhere(
                or(
                    eq(dossiers.name, hoSoId),
                    eq(dossiers.folderPath, hoSoId),
                    like(dossiers.folderPath, `%/${hoSoId}`),
                ),
            ),
            orderBy: [desc(dossiers.updatedAt)],
        });
        if (byHoSoId) return byHoSoId;
    }

    const folderPath = deriveFolderPathFromProcessedKey(input.output_path);
    const byPath = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.folderPath, folderPath)),
    });
    if (byPath) return byPath;

    throw httpError.notFound(
        `Dossier not found for ho_so_id=${hoSoId || "(empty)"} output_path=${input.output_path}`,
    );
}

/**
 * Attach worker output to dossier.
 *
 * Kafka path (preferred): message brings ho_so_id + output_path/json_path
 *   e.g. output_path = "tt05_metadata/documents/documents.json"
 * Scanner fallback still derives from storage key under processed/ or tt05_metadata/.
 */

export async function handleOcrCallback(input: {
    ho_so_id: string;
    output_path: string;
}) {
    const { output_path } = input;

    const dossier = await resolveDossierForOcrCallback(input);
    const folderPath = dossier.folderPath;

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

        // Chặn race với reopenDossierForOcr: scanner có thể liệt kê file JSON
        // trước khi reopen xóa nó. Kiểm tra tồn tại SAU khi giữ row lock — nếu
        // reopen đã commit (file đã xóa) thì bỏ qua, không gán key mồ côi.
        if (!(await processedJsonExists(normalizedOutputPath))) {
            throw httpError.notFound(
                `OCR output no longer exists on storage: ${normalizedOutputPath}`,
            );
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

    scheduleOcrCompletedNotification({
        dossierId: txResult.dossierId,
        folderId: txResult.folderId,
        folderPath,
        dossierName: dossier.name,
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

    // Loại tài liệu chỉ được tạo/gán sau biên tập + QC duyệt (không sync tại OCR).

    if (txResult.status === DossierStatus.ARCHIVED) {
        enqueueDossierIndex(txResult.dossierId);
    }

    return {
        dossierId: txResult.dossierId,
        folderPath,
        ocrMetadataKey: txResult.ocrMetadataKey,
        status: txResult.status,
    };
}
