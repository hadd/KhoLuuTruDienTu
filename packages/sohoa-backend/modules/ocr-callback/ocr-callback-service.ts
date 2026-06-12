import { eq } from "drizzle-orm";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { httpError } from "@shared/common-lib";
import {
    deriveFolderPathFromProcessedKey,
    isDerivedProcessedMetadataKey,
} from "../dossier/dossier-path-utils.ts";
import { emitOcrCompleted } from "../../libs/socket-io.ts";
import { recordSnapshot } from "../metadata-history/metadata-history-service.ts";

const OCR_ADVANCEABLE_STATUSES: DossierStatus[] = [
    DossierStatus.NEW,
    DossierStatus.OCR_PROCESSING,
    DossierStatus.OCR_FAILED,
];

export type OcrCallbackSkipReason =
    | "derived_metadata_key"
    | "already_synced"
    | "dossier_past_ocr_phase";

export type OcrCallbackResult = {
    dossierId: string;
    folderPath: string;
    ocrMetadataKey: string;
    status: DossierStatus;
    skipped?: boolean;
    skipReason?: OcrCallbackSkipReason;
};

/** Chỉ sync currentMetadataKey khi chưa có bản chỉnh sửa (vẫn trỏ về OCR gốc). */
export function shouldSyncCurrentMetadataKeyOnOcr(dossier: {
    ocrMetadataKey: string | null;
    currentMetadataKey: string | null;
}): boolean {
    return (
        !dossier.currentMetadataKey
        || (dossier.ocrMetadataKey !== null && dossier.currentMetadataKey === dossier.ocrMetadataKey)
    );
}

/** ocrMetadataKey từng bị ghi nhầm sang file _EDITOR — cho phép sửa lại bằng bản OCR gốc. */
export function isRepairingDerivedOcrMetadataKey(
    dossier: { ocrMetadataKey: string | null },
    output_path: string,
): boolean {
    return (
        !!dossier.ocrMetadataKey
        && isDerivedProcessedMetadataKey(dossier.ocrMetadataKey)
        && !isDerivedProcessedMetadataKey(output_path)
    );
}

export function buildOcrCallbackUpdate(
    dossier: {
        ocrMetadataKey: string | null;
        currentMetadataKey: string | null;
        status: DossierStatus;
    },
    output_path: string,
): {
    repairingDerivedOcrKey: boolean;
    updateSet: Partial<typeof dossiers.$inferInsert>;
} {
    const repairingDerivedOcrKey = isRepairingDerivedOcrMetadataKey(dossier, output_path);
    const updateSet: Partial<typeof dossiers.$inferInsert> = {
        ocrMetadataKey: output_path,
    };

    if (shouldSyncCurrentMetadataKeyOnOcr(dossier)) {
        updateSet.currentMetadataKey = output_path;
    }

    if (!repairingDerivedOcrKey && OCR_ADVANCEABLE_STATUSES.includes(dossier.status)) {
        updateSet.status = DossierStatus.READY_FOR_ENTRY;
    }

    return { repairingDerivedOcrKey, updateSet };
}

export function hasOcrCallbackChanges(
    dossier: {
        ocrMetadataKey: string | null;
        currentMetadataKey: string | null;
        status: DossierStatus;
    },
    updateSet: Partial<typeof dossiers.$inferInsert>,
): boolean {
    if (updateSet.ocrMetadataKey !== undefined && dossier.ocrMetadataKey !== updateSet.ocrMetadataKey) {
        return true;
    }
    if (
        updateSet.currentMetadataKey !== undefined
        && dossier.currentMetadataKey !== updateSet.currentMetadataKey
    ) {
        return true;
    }
    if (updateSet.status !== undefined && dossier.status !== updateSet.status) {
        return true;
    }
    return false;
}

export function evaluateOcrCallbackSkip(
    dossier: { ocrMetadataKey: string | null; status: DossierStatus },
    output_path: string,
): OcrCallbackSkipReason | null {
    if (isDerivedProcessedMetadataKey(output_path)) {
        return "derived_metadata_key";
    }
    if (dossier.ocrMetadataKey === output_path) {
        return "already_synced";
    }
    if (
        dossier.ocrMetadataKey
        && !OCR_ADVANCEABLE_STATUSES.includes(dossier.status)
        && !isRepairingDerivedOcrMetadataKey(dossier, output_path)
    ) {
        return "dossier_past_ocr_phase";
    }
    return null;
}

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
}): Promise<OcrCallbackResult> {
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

    const skipReason = evaluateOcrCallbackSkip(dossier, output_path);
    if (skipReason) {
        return {
            dossierId: dossier.id,
            folderPath,
            ocrMetadataKey: dossier.ocrMetadataKey ?? output_path,
            status: dossier.status,
            skipped: true,
            skipReason,
        };
    }

    const fromStatus = dossier.status;
    const { repairingDerivedOcrKey, updateSet: plannedUpdate } = buildOcrCallbackUpdate(
        dossier,
        output_path,
    );

    if (!hasOcrCallbackChanges(dossier, plannedUpdate)) {
        return {
            dossierId: dossier.id,
            folderPath,
            ocrMetadataKey: dossier.ocrMetadataKey ?? output_path,
            status: dossier.status,
            skipped: true,
            skipReason: "already_synced",
        };
    }

    const updateSet: Partial<typeof dossiers.$inferInsert> = {
        ...plannedUpdate,
        updatedAt: new Date(),
    };

    await db.transaction(async (tx) => {
        await tx
            .update(dossiers)
            .set(updateSet)
            .where(eq(dossiers.id, dossier.id));

        if (!repairingDerivedOcrKey) {
            await tx.insert(workflowLogs).values({
                dossierId: dossier.id,
                actorId: null,
                action: "OCR_COMPLETED",
                fromStatus,
                toStatus: updateSet.status ?? fromStatus,
                notes: `OCR metadata saved: ${output_path}`,
            });
        }
    });

    const status = repairingDerivedOcrKey
        ? fromStatus
        : OCR_ADVANCEABLE_STATUSES.includes(fromStatus)
            ? DossierStatus.READY_FOR_ENTRY
            : fromStatus;

    if (!repairingDerivedOcrKey) {
        emitOcrCompleted({
            dossierId: dossier.id,
            folderId: dossier.folderId,
            folderPath,
            status,
            fromStatus,
            ocrMetadataKey: output_path,
        });

        recordSnapshot({
            dossierId: dossier.id,
            actorId: null,
            role: null,
            action: "OCR_COMPLETED",
            fromStatus,
            toStatus: status,
            s3Key: output_path,
            notes: `OCR metadata saved: ${output_path}`,
        }).catch((err) => {
            console.error("[MetadataHistory] Failed to record OCR snapshot:", err);
        });
    } else {
        console.info(
            `[OCR] Repaired ocrMetadataKey dossierId=${dossier.id} `
                + `from=${dossier.ocrMetadataKey} to=${output_path} (currentMetadataKey unchanged)`,
        );
    }

    return {
        dossierId: dossier.id,
        folderPath,
        ocrMetadataKey: output_path,
        status,
        skipped: false,
    };
}
