import { eq } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { env } from "../../env.ts";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import { getS3Client } from "../../libs/s3.ts";
import {
    expandKeysWithDocJsonMirrors,
    normalizeStorageKey,
    PROCESSED_STORAGE_PREFIX,
    storageBasename,
    storageDirname,
    toDocJsonDataLakePrefix,
} from "../dossier/dossier-path-utils.ts";
import { isProtectedArchivalKey } from "../dossier/dossier-delete-utils.ts";
import {
    getActivePlacementForDossier,
    PlacementService,
} from "../physical-warehouse/physical-placement-service.ts";
import { enqueueDossierDelete } from "../search/search-index-queue.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function resolveS3Bucket(): string {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    return bucket;
}

async function deleteStorageObjectQuiet(objectName: string): Promise<void> {
    const key = normalizeStorageKey(objectName);
    if (!key || isProtectedArchivalKey(key)) return;

    const s3 = await getS3Client();
    if (!s3) return;

    try {
        await s3.deleteFile({ bucket: resolveS3Bucket(), objectName: key });
    } catch (error) {
        console.warn("[WarehouseReopen] Failed to delete storage object:", key, error);
    }
}

async function listProcessedSiblingKeys(canonicalKey: string): Promise<string[]> {
    const normalized = normalizeStorageKey(canonicalKey);
    if (!normalized.startsWith(`${PROCESSED_STORAGE_PREFIX}/`)) {
        return [normalized];
    }

    const prefix = storageDirname(normalized);
    if (!prefix) return [normalized];

    const s3 = await getS3Client();
    if (!s3) return [normalized];

    try {
        const listed = await s3.listFiles({
            bucket: resolveS3Bucket(),
            prefix: `${prefix}/`,
            maxKeys: 200,
        });
        const keys = listed.files
            .map((f) => f.objectName)
            .filter((name): name is string => Boolean(name?.endsWith(".json")));
        return keys.length > 0 ? keys : [normalized];
    } catch {
        return [normalized];
    }
}

async function listDocJsonMirrorKeys(folderPath: string | null | undefined): Promise<string[]> {
    if (!folderPath) return [];
    const prefix = toDocJsonDataLakePrefix(folderPath);
    if (!prefix) return [];

    const s3 = await getS3Client();
    if (!s3) return [];

    try {
        const listed = await s3.listFiles({
            bucket: resolveS3Bucket(),
            prefix,
            maxKeys: 200,
        });
        return listed.files
            .map((f) => f.objectName)
            .filter((name): name is string => Boolean(name));
    } catch {
        return [];
    }
}

/**
 * Worker OCR chỉ chạy khi có sự kiện "file mới" trong folder raw. Xóa/chuyển file
 * đi KHÔNG sinh sự kiện đó, nên hồ sơ nguồn sẽ kẹt ở NEW mãi không được OCR lại.
 * Hàm này ghi đè tại chỗ (re-put) file nhỏ nhất còn lại để MinIO phát
 * ObjectCreated:Put, kích worker quét lại folder. Best-effort: lỗi chỉ log warn.
 */
export async function triggerOcrFolderRescan(dossierId: string): Promise<boolean> {
    try {
        const files = await db
            .select({
                filePath: dossierFiles.filePath,
                fileSizeKb: dossierFiles.fileSizeKb,
            })
            .from(dossierFiles)
            .where(eq(dossierFiles.dossierId, dossierId));

        const candidates = files
            .map((f) => ({
                key: normalizeStorageKey(f.filePath),
                sizeKb: f.fileSizeKb ?? Number.MAX_SAFE_INTEGER,
            }))
            .filter((f) => f.key && !isProtectedArchivalKey(f.key))
            .sort((a, b) => a.sizeKb - b.sizeKb);

        if (candidates.length === 0) return false;

        const s3 = await getS3Client();
        if (!s3) return false;

        const bucket = resolveS3Bucket();
        const client = s3.getMinIOClient();
        const key = candidates[0].key;

        const stat = await client.statObject(bucket, key);
        const stream = await client.getObject(bucket, key);
        await client.putObject(bucket, key, stream, stat.size, {
            "Content-Type": stat.metaData?.["content-type"] ?? "application/pdf",
        });
        return true;
    } catch (error) {
        console.warn(
            "[WarehouseReopen] Failed to trigger OCR folder rescan for dossier:",
            dossierId,
            error,
        );
        return false;
    }
}

/**
 * Clear OCR metadata, remove processed JSON at the same dossier-named path
 * (so OCR can overwrite later), set status NEW, dequeue ES, deactivate placement.
 */
export async function reopenDossierForOcr(input: {
    dossierId: string;
    actorId?: string | null;
    notes?: string;
    tx?: DbTx;
}): Promise<{ dossierId: string; fromStatus: string; status: typeof DossierStatus.NEW }> {
    const run = async (tx: DbTx) => {
        const [locked] = await tx
            .select({
                id: dossiers.id,
                status: dossiers.status,
                ocrMetadataKey: dossiers.ocrMetadataKey,
                currentMetadataKey: dossiers.currentMetadataKey,
                folderPath: dossiers.folderPath,
                name: dossiers.name,
            })
            .from(dossiers)
            .where(eq(dossiers.id, input.dossierId))
            .for("update");

        if (!locked) {
            throw httpError.notFound("Không tìm thấy hồ sơ");
        }

        if (locked.status !== DossierStatus.ARCHIVED) {
            throw httpError.badRequest(
                "Chỉ hồ sơ đã lưu kho mới có thể mở lại OCR từ kho",
            );
        }

        const keys = new Set<string>();
        if (locked.ocrMetadataKey) {
            for (const key of await listProcessedSiblingKeys(locked.ocrMetadataKey)) {
                keys.add(normalizeStorageKey(key));
            }
        }
        if (locked.currentMetadataKey) {
            keys.add(normalizeStorageKey(locked.currentMetadataKey));
        }
        for (const key of await listDocJsonMirrorKeys(locked.folderPath)) {
            keys.add(normalizeStorageKey(key));
        }
        expandKeysWithDocJsonMirrors(keys);

        for (const key of keys) {
            await deleteStorageObjectQuiet(key);
        }

        const fromStatus = locked.status;
        await tx
            .update(dossiers)
            .set({
                ocrMetadataKey: null,
                currentMetadataKey: null,
                status: DossierStatus.NEW,
                updatedAt: new Date(),
            })
            .where(eq(dossiers.id, locked.id));

        await tx.insert(workflowLogs).values({
            dossierId: locked.id,
            actorId: input.actorId ?? null,
            action: "REOPEN_FOR_OCR",
            fromStatus,
            toStatus: DossierStatus.NEW,
            notes: input.notes ??
                `Warehouse file change — cleared OCR metadata for dossier ${locked.name}`,
        });

        return {
            dossierId: locked.id,
            fromStatus,
            status: DossierStatus.NEW,
        };
    };

    const result = input.tx
        ? await run(input.tx)
        : await db.transaction((tx) => run(tx));

    enqueueDossierDelete(result.dossierId);

    const active = await getActivePlacementForDossier(result.dossierId);
    if (active) {
        await PlacementService.remove({
            dossierId: result.dossierId,
            notes: "REMOVED — hồ sơ mở lại OCR từ quản lý kho",
        }).catch((err) => {
            console.warn("[WarehouseReopen] Failed to deactivate placement:", err);
        });
    }

    return result;
}

export function resolveWorkingFilePath(input: {
    folderPath: string;
    currentFilePath: string;
    fileName: string;
}): string {
    const current = normalizeStorageKey(input.currentFilePath);
    if (!isProtectedArchivalKey(current)) {
        return current;
    }
    const folder = normalizeStorageKey(input.folderPath).replace(/\/+$/, "");
    const base = storageBasename(input.fileName) || storageBasename(current) || "document.pdf";
    return `${folder}/${crypto.randomUUID()}-${base}`;
}
