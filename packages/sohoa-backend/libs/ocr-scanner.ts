import { eq } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { handleOcrCallback } from "../modules/ocr-callback/ocr-callback-service.ts";
import { env } from "../env.ts";
import { getS3Client } from "./s3.ts";

const PROCESSED_PREFIX = "processed/";

function deriveHoSoId(outputPath: string): string {
    const parts = outputPath
        .replace(/^processed\//, "")
        .replace(/\.json$/, "")
        .split("/");
    return parts[parts.length - 1];
}

function deriveFolderPath(outputPath: string): string {
    const rawPrefix = env.STORAGE_RAW_PREFIX ?? "raw";
    return (
        rawPrefix +
        "/" +
        outputPath.replace(/^processed\//, "").replace(/\.json$/, "")
    );
}

async function scanAndSync(): Promise<void> {
    const s3 = await getS3Client();
    if (!s3) {
        console.warn("[Scanner] S3 client not available, skipping scan");
        return;
    }

    const config = s3.getConfig();
    const result = await s3.listFiles({
        bucket: config.bucket,
        prefix: PROCESSED_PREFIX,
        maxKeys: 1000,
    });

    const jsonFiles = result.files.filter((f) => f.objectName?.endsWith(".json"));

    let updated = 0;
    let skipped = 0;

    for (const file of jsonFiles) {
        const output_path = file.objectName;
        if (!output_path) continue;

        const folderPath = deriveFolderPath(output_path);

        const dossier = await db.query.dossiers.findFirst({
            where: eq(dossiers.folderPath, folderPath),
            columns: { id: true, ocrMetadataKey: true, status: true },
        });

        if (!dossier) {
            skipped++;
            continue;
        }

        // Skip nếu đã được cập nhật với đúng đường dẫn này
        if (dossier.ocrMetadataKey === output_path) {
            skipped++;
            continue;
        }

        const ho_so_id = deriveHoSoId(output_path);

        try {
            const result = await handleOcrCallback({ ho_so_id, output_path });
            updated++;
            console.info(
                `[Scanner] Updated — dossierId: ${result.dossierId}, status: ${result.status}`,
            );
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("not found")) {
                console.warn(`[Scanner] Dossier not found for: ${output_path}`);
            } else {
                console.error(`[Scanner] Failed to process ${output_path}:`, err);
            }
        }
    }

    if (updated > 0 || jsonFiles.length === 0) {
        console.info(
            `[Scanner] Scan done — ${updated} updated, ${skipped} skipped, ${jsonFiles.length} total`,
        );
    }
}

export function startOcrScanner(intervalMs = 30_000): void {
    console.info(`[Scanner] OCR scanner started (interval: ${intervalMs / 1000}s)`);
    scanAndSync().catch((err) => console.error("[Scanner] Initial scan error:", err));
    setInterval(() => {
        scanAndSync().catch((err) => console.error("[Scanner] Scan error:", err));
    }, intervalMs);
}
